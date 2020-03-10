import query, { querySubsets } from '../utils/buildQuery'
import {
  User,
  Mentor,
  Slots,
  Meetups,
  UserHandles,
  Tags,
  UserTags,
} from '../models'
import { signIn, checkPassword, hashPassword } from '../auth'
import { AuthenticationError, UserInputError, ForbiddenError } from '../error'
import uuidv4 from 'uuid/v4'
import {
  sendMessage,
  sendMeetupRequest,
  sendMeetupConfirmation,
} from '../email'
import { addMeetup, deleteMeetup, getClient } from '../gcal'
import knex from '../db'
import * as obj from '../utils/object'

export default {
  signIn: async (_, { input: { email, password } }, ctx, info) => {
    const [user] = await query(User, info, 'email', 'password').where({
      email,
    })
    const token = signIn(user, password)
    if (!token) throw new UserInputError('invalid credentials')
    ctx.setHeader(
      'Set-Cookie',
      `auth=${token}; HttpOnly; Max-Age=${60 ** 2 * 24 * 14}`
    )
    ctx.id = user.id
    return user
  },

  signOut: (_, __, ctx) => {
    if (!ctx.id) throw new AuthenticationError('not logged in')
    ctx.setHeader('Set-Cookie', 'auth=deleted; HttpOnly; Max-Age=-1')
    ctx.id = null
  },

  createAccount: async (
    _,
    { input: { devPass, name, email, password } },
    ctx
  ) => {
    // if (devPass !== process.env.DEV_PASSWORD)
    //   throw new ForbiddenError('incorrect dev password')
    // const [existing] = await User.query()
    //   .where({ email })
    //   .orWhere({ name })
    // if (existing)
    //   throw new UserInputError(
    //     `user with ${
    //       existing.email === email ? `email "${email}"` : `name "${name}"`
    //     } already exists`
    //   )
    // password = hashPassword(password)
    // const user = await User.query().insertAndFetch({
    //   id: uuidv4(),
    //   name,
    //   email,
    //   password,
    //   type: 'mentor',
    //   newsfeed: 'N',
    //   handle: name.toLowerCase().replace(/\s/g, '.'),
    // })
    // ctx.setHeader(
    //   'Set-Cookie',
    //   `auth=${signIn(user, password)}; HttpOnly; Max-Age=${60 ** 2 * 24 * 14}`
    // )
    // ctx.id = user.id
    // return user
  },

  updateProfile: async (_, { input }, { id }) => {
    if (!id) throw new AuthenticationError('not logged in')

    const handles = (input.social ?? [])
      .filter(({ platform, handle }) => platform && handle)
      .map(({ platform, handle }) => ({
        user_id: id,
        platform_id: platform,
        handle,
      }))
    const removedHandles = (input.social ?? [])
      .filter(({ platform, handle }) => platform && !handle)
      .map(({ platform }) => platform)

    await Promise.all([
      handles.length &&
        knex.raw(
          `${knex('user_handles')
            .insert(handles)
            .toString()} ON CONFLICT (user_id, platform_id) DO UPDATE SET handle=excluded.handle`
        ),
      removedHandles.length &&
        UserHandles.query()
          .delete()
          .whereInComposite(
            ['user_id', 'platform_id'],
            removedHandles.map(v => [id, v])
          ),
    ])

    const tags: string[] = Array.from(
      new Set((input.tags ?? []).map(v => v.toLowerCase()))
    )
    if (tags.length) {
      const currentTags = await UserTags.query().where({ user_id: id })
      let existing = await Tags.query()
      let unknown = tags.filter(
        tag => !existing.find(({ name }) => name === tag)
      )
      if (unknown.length)
        existing = [
          ...existing,
          ...(await Tags.query().insertAndFetch(
            unknown.map(name => ({ name }))
          )),
        ]
      const currentTagNames = currentTags.map(
        ({ tag_id }) => existing.find(({ id }) => id === tag_id).name
      )
      const newTags = tags
        .filter(tag => !currentTagNames.includes(tag))
        .map(name => existing.find(tag => tag.name === name).id)

      if (newTags.length)
        await UserTags.query().insert(
          newTags.map(tag_id => ({ tag_id, user_id: id }))
        )

      const removedTags = currentTagNames
        .filter(tag => !tags.includes(tag))
        .map(tag => existing.find(({ name }) => name === tag).id)

      if (removedTags.length)
        await UserTags.query()
          .del()
          .where({ user_id: id })
          .whereIn('tag_id', removedTags)
    }

    return await User.query()
      .upsertGraphAndFetch({
        id,
        ...obj.filterKeys(input, [
          'name',
          'handle',
          'location',
          'website',
          'biography',
        ]),
        // @ts-ignore
        mentors: { id, ...obj.filterKeys(input, ['title', 'company']) },
      })
      .withGraphFetched('socialmedia')
      .withGraphFetched('tags')
  },

  requestEmailChange() {},
  requestPasswordChange() {},

  deleteAccount: async (_, { password }, { id, setHeader }) => {
    if (!id) throw new AuthenticationError('not logged in')
    const user = await User.query()
      .select('id', 'password')
      .findById(id)
    if (!checkPassword(user, password))
      throw new ForbiddenError('wrong password')
    setHeader('Set-Cookie', 'auth=deleted; HttpOnly; Max-Age=-1')
    await User.query().deleteById(id)
  },

  setProfileVisibility: async (_, { visibility }, { id, role }, info) => {
    if (!id) throw new AuthenticationError('not logged in')
    if (role !== 'mentor')
      throw new UserInputError(`can't set visibility of ${role} account`)
    await Mentor.query().patchAndFetchById(id, {
      listed: visibility === 'LISTED',
    })
    return await query(User, info).findById(id)
  },

  updateNotificationPreferences: async (
    _,
    { input: { receiveEmails, slotReminder } },
    { id, role }
  ) => {
    if (!id) throw new AuthenticationError('not logged in')
    if (slotReminder && role !== 'mentor')
      throw new UserInputError(`can't set slot reminder as ${role}`)

    const user = await User.query().upsertGraphAndFetch({
      id,
      ...(typeof receiveEmails === 'boolean' && {
        allow_emails: receiveEmails,
      }),
      // @ts-ignore
      mentors: {
        id,
        ...(slotReminder && {
          slot_reminder_email: slotReminder.toLowerCase(),
        }),
      },
    })

    return user
  },

  updateSlots: async (
    _,
    { slots: { deleted = [], added = [] } },
    { id },
    info
  ) => {
    if (!id) throw new AuthenticationError('not logged in')

    const addList = added.map(({ start, end }, i) => {
      start = new Date(start)
      end = new Date(end ? end : start.getTime() + 30 * 60 * 1000)
      Object.entries({ start, end }).map(([k, v]) => {
        if (isNaN(v.getTime()))
          throw new UserInputError(
            `invalid ${k} time "${start}" in added[${i}]`
          )
      })
      if (end.getTime() <= start.getTime())
        throw new UserInputError(
          `end time must be after start time in added[${i}]`
        )
      return { start, end, mentor_id: id, id: uuidv4() }
    })

    await Promise.all([
      addList.length && Slots.query().insert(addList),
      deleted.length &&
        Slots.query()
          .whereIn('id', deleted)
          .delete(),
    ])

    const user = await query(User, info).findById(id)

    if (user.google_refresh_token) {
      const client = await getClient(id, user.google_refresh_token)
      await Promise.all([
        ...addList.map(
          ({ id, start, end }) =>
            client.calendar.events.insert({
              calendarId: user.google_calendar_id,
              requestBody: {
                id: id.replace(/[^\w]/g, ''),
                summary: 'Upframe Slot',
                start: { dateTime: start },
                end: { dateTime: end },
                transparency: 'transparent',
              },
            }) as Promise<any>
        ),
        ...deleted.map(id =>
          client.calendar.events
            .delete({
              calendarId: user.google_calendar_id,
              eventId: id.replace(/[^\w]/g, ''),
            })
            .catch(() => Promise.resolve())
        ),
      ])
    }
    return user
  },

  messageExt: async (_, { input }) => {
    const receiver = await query(User, null, 'email', 'name').findById(input.to)
    if (!receiver?.email) throw new UserInputError('unknown receier')
    if (!new RegExp(User.jsonSchema.properties.email.pattern).test(input.email))
      throw new UserInputError(`invalid email ${input.email}`)
    if (input.name.length < 3) throw new UserInputError(`invalid name`)
    if (input.message.length < 10)
      throw new UserInputError('must provide message')
    sendMessage(
      receiver,
      { name: input.name, email: input.email },
      input.message
    )
  },

  requestSlot: async (_, { input }) => {
    if (!new RegExp(User.jsonSchema.properties.email.pattern).test(input.email))
      throw new UserInputError(`invalid email ${input.email}`)
    if (input.name.length < 3) throw new UserInputError(`invalid name`)
    const slot = await Slots.query().findById(input.slotId)
    if (!slot) throw new UserInputError('unknown slot')
    const mentor = await User.query()
      .select(
        'id',
        'name',
        'email',
        'handle',
        'upframeCalendarId',
        'googleRefreshToken'
      )
      .findById(slot.mentorUID)
    let [mentee]: User[] = await User.query()
      .select('id', 'name', 'email')
      .where({
        email: input.email,
      })
    if (!mentee)
      mentee = await User.query().insertAndFetch({
        id: uuidv4(),
        email: input.email,
        name: input.name,
        type: 'user',
      })
    const meetup = {
      mid: uuidv4(),
      sid: slot.sid,
      menteeUID: mentee.id,
      mentorUID: mentor.id,
      message: input.message,
      status: 'pending',
      start: slot.start,
      location: `https://talky.io/${mentor.handle}`,
    }
    await Meetups.query().insert(meetup)
    sendMeetupRequest(mentor, mentee, meetup)

    if (mentor.googleRefreshToken)
      (
        await getClient(mentor.id, mentor.googleRefreshToken)
      ).calendar.events.patch({
        calendarId: mentor.upframeCalendarId,
        eventId: slot.sid.replace(/[^\w]/g, ''),
        requestBody: {
          summary: 'Upframe Slot (requested)',
          description: `<p>Slot was requested by <a href="mailto:${mentee.email}">${mentee.name}</a></p><p><i>${input.message}</i></p><p><a href="https://upframe.io/meetup/confirm/${meetup.mid}">accept</a> | <a href="https://upframe.io/meetup/cancel/${meetup.mid}">refuse</a></p>`,
        },
      })
  },

  acceptMeetup: async (_, { meetupId }, { id }, info) => {
    if (!id) throw new AuthenticationError('Not logged in.')
    const meetup = await Meetups.query().findById(meetupId)
    if (!meetup?.mid) throw new UserInputError('unknown meetup')
    if (meetup.mentorUID !== id)
      throw new ForbiddenError(
        "Can't accept meetup. Please make sure that you are logged in with the correct account."
      )
    if (meetup.status === 'confirmed')
      throw new UserInputError('meetup already confirmed')

    const [parts] = await Promise.all([
      querySubsets(
        User,
        ['mentor', 'mentee'],
        info,
        'name',
        'email',
        'googleRefreshToken',
        'upframeCalendarId'
      ).whereIn('id', [meetup.mentorUID, meetup.menteeUID]),
      Meetups.query()
        .findById(meetupId)
        .patch({ status: 'confirmed' }),
      Slots.query().deleteById(meetup.sid),
    ])

    const mentor = parts.find(({ id }) => id === meetup.mentorUID)
    const mentee = parts.find(({ id }) => id === meetup.menteeUID)

    sendMeetupConfirmation(mentor, mentee, meetup)
    const googleId = await addMeetup(meetup, mentor, mentee, meetup.sid)

    await Meetups.query()
      .patch({ googleId })
      .where({ mid: meetup.mid })

    return { ...meetup, mentor, mentee }
  },

  cancelMeetup: async (_, { meetupId }, { id }) => {
    const meetup = await Meetups.query().findById(meetupId)
    if (!meetup) throw new UserInputError('unknown meetup')
    if (id !== meetup.mentorUID && id !== meetup.menteeUID)
      throw new ForbiddenError(
        "Can't cancel meetup. Please make sure that you are logged in with the correct account."
      )

    const user = await User.query()
      .select('id', 'upframeCalendarId', 'googleRefreshToken')
      .findById(id)

    await Promise.all([
      Meetups.query().deleteById(meetupId) as Promise<any>,
      ...(meetup.status === 'confirmed'
        ? [
            Slots.query().insert({
              sid: meetup.sid,
              mentorUID: meetup.mentorUID,
              start: meetup.start,
            }),
            deleteMeetup(meetup, user),
          ]
        : []),
    ])
  },

  connectCalendar: async (_, { code }, { id }, info) => {
    if (!id) throw new AuthenticationError('not logged in')
    const { google_refresh_token } = await Mentor.query()
      .select('google_refresh_token')
      .findById(id)
    if (google_refresh_token)
      throw new UserInputError('must first disconnect connected calendar')

    try {
      const { tokens } = await (await getClient()).auth.getToken(code)

      const client = await getClient(id, tokens.refresh_token)
      const { data } = await client.calendar.calendars.insert({
        requestBody: { summary: 'Upframe' },
      })

      await Mentor.query()
        .findById(id)
        .patch({
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          google_calendar_id: data.id,
        })
      return await query(User, info).findById(id)
    } catch (e) {
      console.log(e)
      throw e
    }
  },

  disconnectCalendar: async (_, __, { id }, info) => {
    if (!id) throw new AuthenticationError('not logged in')

    const { google_refresh_token, google_calendar_id, ...user } = await query(
      Mentor,
      info
    ).findById(id)

    if (!google_refresh_token)
      throw new UserInputError('calendar not connected')

    if (google_calendar_id)
      (await getClient(id)).calendar.calendars.delete({
        calendarId: google_refresh_token,
      })

    await Promise.all([
      (await getClient()).auth.revokeToken(google_refresh_token),
      Mentor.query()
        .findById(id)
        .patch({ google_refresh_token: null, google_access_token: null }),
    ])

    return user
  },
}
