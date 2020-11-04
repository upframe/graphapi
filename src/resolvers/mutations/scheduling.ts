import uuidv4 from 'uuid/v4'
import { send } from '../../email'
import { addMeetup } from '../../gcal'
import { User, Slots, Meetup, ConnectGoogle } from '../../models'
import resolver from '../resolver'
import { system } from '../../authorization/user'
import { UserInputError, ForbiddenError } from '../../error'
import { UniqueViolationError } from 'objection'
import { userClient } from '../../google'
import axios from 'axios'
import Conversation from '~/messaging/conversation'
import Channel from '~/messaging/channel'
import token from '~/utils/token'
import { calendar, upframeClient } from '~/google'

export const updateSlots = resolver<User>().loggedIn(
  async ({
    query,
    knex,
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

    const existing = (
      await query.raw(Slots).where({ mentor_id: id })
    ).map(({ start, end }) => ({ start: new Date(start), end: new Date(end) }))

    if (
      addList.some(added =>
        [...existing, ...addList.filter(v => v !== added)].some(
          slot =>
            added.start.getTime() < new Date(slot.end).getTime() &&
            new Date(slot.start).getTime() < added.end.getTime()
        )
      )
    )
      throw new UserInputError("can't add overlapping slots")

    await Promise.all([
      addList.length && query.raw(Slots).insert(addList),
      deleted.length && query.raw(Slots).delete().whereIn('id', deleted),
    ])

    logger.info('slots updated', { user: id, added: addList, deleted })

    const user = await query({ include: 'connect_google' }).findById(id)

    if (!user.connect_google?.calendar_id) return user

    const client = await userClient(knex, user.connect_google)
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

export const requestSlot = resolver<string>().loggedIn(
  async ({ query, knex, args: { input }, ctx: { id } }) => {
    const slot = await query.raw(Slots).findById(input.slotId)

    if (!slot) throw new UserInputError('unknown slot')

    const [mentor, mentee] = await Promise.all([
      query
        .raw(User)
        .withGraphFetched('connect_google')
        .findById(slot.mentor_id)
        .asUser(system),
      query.raw(User).findById(id),
    ])

    const BEARER_TOKEN = process.env.WHEREBY_API_TOKEN
    const headers = {
      Authorization: `Bearer ${BEARER_TOKEN}`,
      'Content-Type': 'application/json',
    }

    const endTimeObj = new Date(slot.end)
    endTimeObj.setHours(endTimeObj.getHours() + 2)

    const body = {
      startDate: slot.start,
      endDate: endTimeObj.toString(),
      fields: ['hostRoomUrl'],
    }

    let roomUrl: string

    try {
      const response = await axios({
        method: 'POST',
        url: 'https://api.whereby.dev/v1/meetings',
        data: body,
        headers,
      })

      if (response.status === 201) {
        const { data } = response
        roomUrl = data.roomUrl
      } else {
        throw new Error('Unable to accept meetup. Please try again.')
      }
    } catch (error) {
      logger.error(
        `Could not create whereby room for slot id: ${slot.id}. Either the request has failed or Status Code other than 201 has been received.`,
        { error }
      )
      throw new Error('Unable to accept meetup. Please try again.')
    }

    const meetup = {
      id: uuidv4(),
      slot_id: slot.id,
      status: 'pending',
      mentee_id: mentee.id,
      message: input.message,
      location: roomUrl,
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

    const channelId = `${(Date.now() / 1000) | 0}${token().slice(0, 4)}_s`
    const conversation = await Conversation.create(
      channelId,
      mentee.id,
      mentor.id
    )

    const channel = await new Channel(channelId).create(
      conversation.id,
      [mentee.id, mentor.id],
      {
        id: meetup.id,
        time: new Date(slot.start).getTime(),
        mentor: mentor.id,
        url: meetup.location,
      }
    )
    await channel.publish({ author: id, content: input.message, suffix: '_s' })

    if (!mentor.connect_google?.calendar_id)
      return `${conversation.id}/${channelId}`
    try {
      const client = await userClient(knex, mentor.connect_google)
      await client.calendar.events.patch({
        calendarId: mentor.connect_google.calendar_id,
        eventId: slot.id.replace(/[^\w]/g, ''),
        requestBody: {
          summary: 'Upframe Slot (requested)',
          description: `<p>Slot was requested by <a href="mailto:${mentee.email}">${mentee.name}</a></p><p><i>${input.message}</i></p><p><a href="https://upframe.io/meetup/confirm/${meetup.slot_id}">accept</a> | <a href="https://upframe.io/meetup/cancel/${meetup.slot_id}">decline</a></p>`,
        },
      })
    } catch (error) {
      logger.error(`couldn't update gcal event ${slot.id}`, { error })
    }

    return `${conversation.id}/${channelId}`
  }
)

export const acceptMeetup = resolver<any>().loggedIn(
  async ({ args: { meetupId }, ctx: { id }, query, knex }) => {
    const meetup = await query
      .raw(Meetup)
      .withGraphFetched('slot')
      .findById(meetupId)

    if (!meetup) throw new UserInputError('unknown meetup')

    if (meetup.slot.mentor_id !== id)
      throw new ForbiddenError(
        "Can't accept meetup. Please make sure that you are logged in with the correct account."
      )
    if (meetup.status === 'confirmed')
      throw new UserInputError('meetup already confirmed')

    const [users] = await Promise.all([
      query.raw(User).whereIn('id', [meetup.slot.mentor_id, meetup.mentee_id]),
      query.raw(Meetup).findById(meetup.id).patch({ status: 'confirmed' }),
    ])

    const mentor = users.splice(
      users.findIndex(({ id }) => id === meetup.slot.mentor_id),
      1
    )[0]
    const mentee = users[0]

    if (!meetup.gcal_upframe_event_id) {
      const gcal = await addMeetup(meetup.slot, meetup, mentor, mentee, knex)
      logger.info({ gcal })
      await query.raw(Meetup).findById(meetup.id).patch(gcal).asUser(system)
    }

    await send({ template: 'SLOT_CONFIRM', ctx: { slot: meetup.slot.id } })
    logger.info('meetup accepted', {
      mentor: mentor.id,
      mentee: mentee.id,
      slot: meetup.slot,
    })

    return {
      start: new Date(meetup.slot.start).toISOString(),
      location: meetup.location,
      mentor,
      mentee,
    }
  }
)

export const cancelMeetup = resolver().loggedIn(
  async ({ query, knex, args: { meetupId }, ctx: { id } }) => {
    const meetup = await query
      .raw(Meetup)
      .withGraphFetched('slot')
      .findById(meetupId)

    if (!meetup) throw new UserInputError('unknown meetup')

    if (id !== meetup.slot.mentor_id && id !== meetup.mentee_id)
      throw new ForbiddenError(
        "Can't cancel meetup. Please make sure that you are logged in with the correct account."
      )

    if (meetup.status === 'cancelled')
      throw new UserInputError('meetup already cancelled')

    const connectGoogle = await query
      .raw(ConnectGoogle)
      .where({ user_id: meetup.slot.mentor_id })
      .first()

    let client = connectGoogle
      ? await userClient(knex, connectGoogle)
      : undefined

    await Promise.allSettled([
      query
        .raw(Meetup)
        .findById(meetupId)
        .patch({ status: 'cancelled', gcal_upframe_event_id: null }),
      connectGoogle &&
        client?.calendar.events.patch({
          calendarId: connectGoogle.calendar_id,
          eventId: meetup.id.replace(/[^\w]/g, ''),
          requestBody: {
            summary: 'Upframe Slot',
            description: ``,
            attendees: [],
          },
        }),
      calendar(upframeClient).events.delete({
        calendarId: process.env.CALENDAR_ID,
        eventId: meetup.gcal_upframe_event_id,
        sendUpdates: client?.calendarId ? 'none' : 'all',
      }),
      client?.calendar?.events?.delete({
        calendarId: client.calendarId,
        eventId: meetup.gcal_user_event_id,
        sendUpdates: 'all',
      }),
    ])

    logger.info('meetup rejected', {
      mentor: meetup.slot.mentor_id,
      mentee: meetup.mentee_id,
      slot: meetup,
    })
  }
)
