import { User, Slots, Meetup } from './models'
import { UserClient, userClient, calendar, upframeClient } from './google'
import logger from './logger'

export async function addMeetup(
  slot: Slots,
  mentor: User,
  mentee: User,
  knex: ResolverCtx['knex']
): Promise<Partial<Meetup>> {
  const event = {
    id: slot.id.replace(/[^\w]/g, ''),
    summary: `Upframe Meetup ${mentor.name.split(' ')[0]} & ${
      mentee.name.split(' ')[0]
    }`,
    location: slot.meetups.location,
    description: `
    Upframe Mentoring Call
    
    <b>Mentor</b>: <a href="https://upframe.io/${mentor.handle}">${
      mentor.name
    }</a>
    <b>Mentee</b>: ${
      mentee.handle
        ? `<a href="https://upframe.io/${mentee.handle}">${mentee.name}</a>`
        : mentee.name
    }

    You can join the call on <a href="${slot.meetups.location}">whereby.com</a>.
    <blockquote>${slot.meetups.message}</blockquote>
    `,
    start: {
      dateTime: slot.start,
      timeZone: 'Europe/Berlin',
    },
    end: {
      dateTime: new Date(
        new Date(slot.start).getTime() + 30 * 60 * 1000
      ).toISOString(),
      timeZone: 'Europe/Berlin',
    },
    transparency: 'opaque',

    attendees: [
      ...(mentor.connect_google?.calendar_id
        ? []
        : [{ email: mentor.email, displayName: mentor.name }]),
      { email: mentee.email, displayName: mentee.name },
    ],
  }

  let gcal_user_event_id: string

  let eventId: string
  if (mentor.connect_google?.calendar_id) {
    try {
      const { data } = await (
        await userClient(knex, mentor.connect_google)
      ).calendar.events.patch({
        calendarId: mentor.connect_google?.calendar_id,
        eventId: event.id,
        requestBody: event,
      })
      gcal_user_event_id = data.id
      delete event.attendees
      eventId = data.id
    } catch (error) {
      logger.error("couldn't create meetup in mentor's calendar", {
        error,
        slot,
      })
      event.attendees.push({ email: mentor.email, displayName: mentor.name })
    }
  }

  try {
    const { data } = await calendar(upframeClient).events.insert({
      calendarId: process.env.CALENDAR_ID,
      requestBody: event,
    })
    eventId = data.id
  } catch (error) {
    logger.error("couldn't create meetup in upframe calendar", { error, slot })
  }

  return { gcal_upframe_event_id: eventId, gcal_user_event_id }
}

export async function deleteMeetup(slot: Slots, client: UserClient) {
  await Promise.all([
    client.calendar.events.delete({
      calendarId: process.env.CALENDAR_ID,
      eventId: slot.meetups.gcal_upframe_event_id,
      sendUpdates: client.calendarId ? 'none' : 'all',
    }),
    client.calendarId &&
      client.calendar.events.delete({
        calendarId: client.calendarId,
        eventId: slot.meetups.gcal_user_event_id,
        sendUpdates: 'all',
      }),
  ])
}
