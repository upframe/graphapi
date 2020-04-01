import uuidv4 from 'uuid/v4'
import { sendMeetupRequest, sendMeetupConfirmation } from '../../email'
import { addMeetup, deleteMeetup, getClient } from '../../gcal'
import { User, Mentor, Slots, Meetup } from '../../models'
import resolver from '../resolver'
import { system } from '../../authorization/user'
import { UserInputError, ForbiddenError } from '../../error'
import { UniqueViolationError } from 'objection'

export const updateSlots = resolver<User>().loggedIn(
  async ({
    query,
    args: {
      slots: { added = [], deleted = [] },
    },
    ctx: { id },
  }) => {
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
      addList.length && query.raw(Slots).insert(addList),
      deleted.length &&
        query
          .raw(Slots)
          .delete()
          .whereIn('id', deleted),
    ])

    const user = await query({ include: 'mentors' }).findById(id)

    if (user.mentors.google_refresh_token) {
      const client = await getClient(id, user.mentors.google_refresh_token)
      await Promise.all([
        ...addList.map(
          ({ id, start, end }) =>
            client.calendar.events.insert({
              calendarId: user.mentors.google_calendar_id,
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
              calendarId: user.mentors.google_calendar_id,
              eventId: id.replace(/[^\w]/g, ''),
            })
            .catch(() => Promise.resolve())
        ),
      ])
    }

    return user
  }
)

export const requestSlot = resolver()(
  async ({ query, args: { input }, ctx: { id } }) => {
    const { email, name, ...rest } = !id
      ? input
      : await query.raw(User).findById(id)

    if (!new RegExp(User.jsonSchema.properties.email.pattern).test(email))
      throw new UserInputError(`invalid email ${email}`)
    if (name.length < 3) throw new UserInputError(`invalid name ${name}`)
    const slot = await query.raw(Slots).findById(input.slotId)
    if (!slot) throw new UserInputError('unknown slot')

    const mentor = await query
      .raw(User)
      .withGraphFetched('mentors')
      .findById(slot.mentor_id)
      .asUser(system)

    const mentee = id
      ? { email, name, ...rest }
      : (await query
          .raw(User)
          .where({ email })
          .first()) ??
        (await query.raw(User).insertAndFetch({
          id: uuidv4(),
          email,
          name,
          role: 'nologin',
          handle: uuidv4(),
          password: '--------',
        }))

    const meetup = {
      slot_id: slot.id,
      status: 'pending',
      mentee_id: mentee.id,
      message: input.message,
      location: `https://talky.io/${mentor.handle}`,
    }

    try {
      await query.raw(Meetup).insert(meetup)
    } catch (e) {
      if (e instanceof UniqueViolationError)
        throw new UserInputError('slot already requested')
      throw e
    }
    sendMeetupRequest(mentor, mentee, { ...meetup, slot })

    if (mentor.mentors?.google_refresh_token)
      await (
        await getClient(mentor.id, mentor.mentors.google_refresh_token)
      ).calendar.events.patch({
        calendarId: mentor.mentors.google_calendar_id,
        eventId: slot.id.replace(/[^\w]/g, ''),
        requestBody: {
          summary: 'Upframe Slot (requested)',
          description: `<p>Slot was requested by <a href="mailto:${mentee.email}">${mentee.name}</a></p><p><i>${input.message}</i></p><p><a href="https://upframe.io/meetup/confirm/${meetup.slot_id}">accept</a> | <a href="https://upframe.io/meetup/cancel/${meetup.slot_id}">decline</a></p>`,
        },
      })
  }
)

export const acceptMeetup = resolver<any>().loggedIn(
  async ({ args: { meetupId }, ctx: { id }, query }) => {
    const slot = await query
      .raw(Slots)
      .findById(meetupId)
      .withGraphFetched('meetups')

    if (!slot?.meetups) throw new UserInputError('unknown meetup')
    if (slot.mentor_id !== id)
      throw new ForbiddenError(
        "Can't accept meetup. Please make sure that you are logged in with the correct account."
      )
    if (slot.meetups.status === 'confirmed')
      throw new UserInputError('meetup already confirmed')

    const [parts] = await Promise.all([
      query
        .raw(User)
        .withGraphFetched('mentors')
        .whereIn('id', [slot.mentor_id, slot.meetups.mentee_id]),
      query
        .raw(Meetup)
        .findById(meetupId)
        .patch({
          status: 'confirmed',
        })
        .asUser(system),
    ])
    const mentor = parts.find(({ id }) => id === slot.mentor_id)
    const mentee = parts.find(({ id }) => id === slot.meetups.mentee_id)

    try {
      sendMeetupConfirmation(mentor, mentee, slot)
      await query
        .raw(Meetup)
        .findById(slot.id)
        .patch(await addMeetup(slot, mentor, mentee))
        .asUser(system)
    } catch (e) {
      console.log(e)
      throw e
    }

    return {
      start: new Date(slot.start).toISOString(),
      location: slot.meetups.location,
      mentor,
      mentee,
    }
  }
)

export const cancelMeetup = resolver().loggedIn(
  async ({ query, args: { meetupId }, ctx: { id } }) => {
    const meetup = await query
      .raw(Slots)
      .withGraphFetched('meetups')
      .findById(meetupId)
    if (!meetup) throw new UserInputError('unknown meetup')
    if (!meetup.meetups) throw new UserInputError('meetup already cancelled')
    if (id !== meetup.mentor_id && id !== meetup.meetups.mentee_id)
      throw new ForbiddenError(
        "Can't cancel meetup. Please make sure that you are logged in with the correct account."
      )

    const mentor = await query.raw(Mentor).findById(meetup.mentor_id)

    await Promise.all([
      query
        .raw(Meetup)
        .deleteById(meetupId)
        .asUser(system),
      mentor.google_refresh_token &&
        mentor.google_refresh_token &&
        (
          await getClient(mentor.id, mentor.google_refresh_token)
        ).calendar.events.patch({
          calendarId: mentor.google_calendar_id,
          eventId: meetup.id.replace(/[^\w]/g, ''),
          requestBody: {
            summary: 'Upframe Slot',
            description: ``,
            attendees: [],
          },
        }),
      deleteMeetup(meetup, mentor).catch(() =>
        console.warn("couldn't delete gcal meetup")
      ),
    ])
  }
)
