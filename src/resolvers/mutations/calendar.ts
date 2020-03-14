import uuidv4 from 'uuid/v4'
import query, { querySubsets } from '../../utils/buildQuery'
import { User, Mentor, Slots, Meetups } from '../../models'
import { sendMeetupRequest, sendMeetupConfirmation } from '../../email'
import { addMeetup, deleteMeetup, getClient } from '../../gcal'
import {
  AuthenticationError,
  UserInputError,
  ForbiddenError,
} from '../../error'

export default {
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
