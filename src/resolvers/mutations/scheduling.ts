import uuidv4 from 'uuid/v4'
import { send } from '../../email'
import { addMeetup, deleteMeetup } from '../../gcal'
import { User, Slots, Meetup, ConnectGoogle } from '../../models'
import resolver from '../resolver'
import { system } from '../../authorization/user'
import { UserInputError, ForbiddenError } from '../../error'
import { UniqueViolationError } from 'objection'
import { userClient } from '../../google'
import logger from '../../logger'

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

    logger.info('slots updated', { user: id, added: addList, deleted })

    const user = await query({ include: 'connect_google' }).findById(id)

    if (!user.connect_google?.calendar_id) return user

    const client = await userClient(user.connect_google)
    await Promise.all([
      ...addList.map(
        ({ id, start, end }) =>
          client.calendar.events.insert({
            calendarId: user.connect_google.calendar_id,
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
            calendarId: user.connect_google.calendar_id,
            eventId: id.replace(/[^\w]/g, ''),
          })
          .catch(() => Promise.resolve())
      ),
    ])

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
      .withGraphFetched('connect_google')
      .findById(slot.mentor_id)
      .asUser(system)

    const mentee = id
      ? { email, name, ...rest }
      : (await query
          .raw(User)
          .where({ email })
          .first()
          .asUser(system)) ??
        (await query.raw(User).insertAndFetch({
          id: uuidv4(),
          email,
          name,
          role: 'nologin',
          handle: uuidv4(),
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
    await send({
      template: 'SLOT_REQUEST',
      ctx: { slot: slot.id, requester: mentee.id },
    })

    logger.info('slot requested', {
      mentor: mentor.id,
      mentee: mentee.id,
      slot,
    })

    if (!mentor.connect_google?.calendar_id) return
    console.log('trace')
    try {
      const client = await userClient(mentor.connect_google)
      client.calendar.events.patch({
        calendarId: mentor.connect_google.calendar_id,
        eventId: slot.id.replace(/[^\w]/g, ''),
        requestBody: {
          summary: 'Upframe Slot (requested)',
          description: `<p>Slot was requested by <a href="mailto:${mentee.email}">${mentee.name}</a></p><p><i>${input.message}</i></p><p><a href="https://upframe.io/meetup/confirm/${meetup.slot_id}">accept</a> | <a href="https://upframe.io/meetup/cancel/${meetup.slot_id}">decline</a></p>`,
        },
      })
    } catch (e) {
      console.log(e)
      console.warn(`couldn't update gcal event ${slot.id}`)
    }
  }
)

export const acceptMeetup = resolver<any>().loggedIn(
  async ({ args: { meetupId }, ctx: { id }, query }) => {
    const slot = await query
      .raw(Slots)
      .findById(meetupId)
      .withGraphFetched('meetups')
      .asUser(system)

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
        .withGraphFetched('connect_google')
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

    if (!slot.meetups.gcal_upframe_event_id)
      try {
        await query
          .raw(Meetup)
          .findById(slot.id)
          .patch(await addMeetup(slot, mentor, mentee))
          .asUser(system)
      } catch (e) {
        console.log(e)
        throw e
      }

    await send({ template: 'SLOT_CONFIRM', ctx: { slot: slot.id } })
    logger.info('meetup accepted', {
      mentor: mentor.id,
      mentee: mentee.id,
      slot,
    })

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

    const connectGoogle = await query
      .raw(ConnectGoogle)
      .where({ user_id: meetup.mentor_id })
      .first()

    let client = connectGoogle ? await userClient(connectGoogle) : undefined

    await Promise.all([
      query
        .raw(Meetup)
        .deleteById(meetupId)
        .asUser(system),
      connectGoogle &&
        client.calendar.events.patch({
          calendarId: connectGoogle.calendar_id,
          eventId: meetup.id.replace(/[^\w]/g, ''),
          requestBody: {
            summary: 'Upframe Slot',
            description: ``,
            attendees: [],
          },
        }),
      deleteMeetup(meetup, client).catch(() =>
        console.warn("couldn't delete gcal meetup")
      ),
    ])

    logger.info('meetup rejected', {
      mentor: meetup.mentor_id,
      mentee: meetup.meetups.mentee_id,
      slot: meetup,
    })
  }
)
