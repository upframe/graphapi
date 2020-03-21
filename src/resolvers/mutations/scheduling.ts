import uuidv4 from 'uuid/v4'
import query from '../../utils/buildQuery'
import { sendMeetupRequest, sendMeetupConfirmation } from '../../email'
import { addMeetup, deleteMeetup, getClient } from '../../gcal'
import { User, Mentor, Slots, Meetup } from '../../models'

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

    const user = await query<User>(info)
      .withGraphFetched('mentors')
      .findById(id)

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
  },

  requestSlot: async (_, { input }, { id }) => {
    let { email, name, ...rest } = !id ? input : await User.query().findById(id)

    if (!new RegExp(User.jsonSchema.properties.email.pattern).test(email))
      throw new UserInputError(`invalid email ${email}`)
    if (name.length < 3) throw new UserInputError(`invalid name ${name}`)
    const slot = await Slots.query().findById(input.slotId)
    if (!slot) throw new UserInputError('unknown slot')

    console.log({ slot })

    const mentor = await User.query()
      .withGraphFetched('mentors')
      .findById(slot.mentor_id)

    const mentee = id
      ? { email, name, ...rest }
      : (await User.query()
          .where({ email })
          .first()) ??
        (await User.query().insertAndFetch({
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
    await Meetup.query().insert(meetup)
    sendMeetupRequest(mentor, mentee, { ...meetup, slot })

    if (mentor.mentors?.google_refresh_token)
      (
        await getClient(mentor.id, mentor.mentors.google_refresh_token)
      ).calendar.events.patch({
        calendarId: mentor.mentors.google_calendar_id,
        eventId: slot.id.replace(/[^\w]/g, ''),
        requestBody: {
          summary: 'Upframe Slot (requested)',
          description: `<p>Slot was requested by <a href="mailto:${mentee.email}">${mentee.name}</a></p><p><i>${input.message}</i></p><p><a href="https://upframe.io/meetup/confirm/${meetup.slot_id}">accept</a> | <a href="https://upframe.io/meetup/cancel/${meetup.slot_id}">decline</a></p>`,
        },
      })
  },

  acceptMeetup: async (_, { meetupId }, { id }, info) => {
    if (!id) throw new AuthenticationError('Not logged in.')
    const slot = await Slots.query()
      .withGraphFetched('meetups')
      .findById(meetupId)
    if (!slot?.meetups) throw new UserInputError('unknown meetup')
    if (slot.mentor_id !== id)
      throw new ForbiddenError(
        "Can't accept meetup. Please make sure that you are logged in with the correct account."
      )
    if (slot.meetups.status === 'confirmed')
      throw new UserInputError('meetup already confirmed')

    const [parts] = await Promise.all([
      querySubsets(
        User,
        ['mentor', 'mentee'],
        info,
        'name',
        'email'
      ).whereIn('id', [slot.mentor_id, slot.meetups.mentee_id]),
      Meetup.query()
        .findById(meetupId)
        .patch({ status: 'confirmed' }),
    ])

    const mentor = parts.find(({ id }) => id === slot.mentor_id)
    const mentee = parts.find(({ id }) => id === slot.meetups.mentee_id)

    sendMeetupConfirmation(mentor, mentee, slot)
    await Meetup.query()
      .findById(meetupId)
      .patch({
        ...(await addMeetup(slot, mentor, mentee)),
      })

    return {
      start: new Date(slot.start).toISOString(),
      location: slot.meetups.location,
      mentor,
      mentee,
    }
  },

  cancelMeetup: async (_, { meetupId }, { id }) => {
    const meetup = await Slots.query()
      .withGraphFetched('meetups')
      .findById(meetupId)
    if (!meetup) throw new UserInputError('unknown meetup')
    if (!meetup.meetups) throw new UserInputError('meetup already cancelled')
    if (id !== meetup.mentor_id && id !== meetup.meetups.mentee_id)
      throw new ForbiddenError(
        "Can't cancel meetup. Please make sure that you are logged in with the correct account."
      )

    const mentor = await Mentor.query()
      .select('id', 'google_calendar_id', 'google_refresh_token')
      .findById(id)

    await Promise.all([
      Meetup.query().deleteById(meetupId),
      mentor.google_refresh_token &&
        (
          await getClient(mentor.id, mentor.google_refresh_token)
        ).calendar.events.patch({
          calendarId: mentor.google_calendar_id,
          eventId: meetup.id.replace(/[^\w]/g, ''),
          requestBody: {
            summary: 'Upframe Slot',
            description: ``,
          },
        }),
      deleteMeetup(meetup, mentor),
    ])
  },
}
