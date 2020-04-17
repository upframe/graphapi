import { User, Mentor, Slots, Meetup } from './models'
import { getClient, generateAuthUrl as authUrl } from './google'

export async function addMeetup(
  slot: Slots,
  mentor: User,
  mentee: User
): Promise<Partial<Meetup>> {
  const event = {
    id: slot.id.replace(/[^\w]/g, ''),
    summary: `Upframe Meetup ${mentor.name.split(' ')[0]} & ${
      mentee.name.split(' ')[0]
    }`,
    location: slot.meetups.location,
    description: `
    Upframe Mentoring Call
    
    <b>Mentor</b>: <a href="https://upframe.io/${mentor.handle}">${mentor.name}</a>
    <b>Mentee</b>: ${mentee.name}

    You can join the call on <a href="${slot.meetups.location}">talky.io</a>.
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
      ...(mentor.mentors.google_calendar_id
        ? []
        : [{ email: mentor.email, displayName: mentor.name }]),
      { email: mentee.email, displayName: mentee.name },
    ],
  }

  let gcal_user_event_id: string
  if (mentor.mentors.google_calendar_id) {
    const { data } = await (
      await getClient(mentor.id, mentor.mentors.google_refresh_token)
    ).calendar.events.patch({
      calendarId: mentor.mentors.google_calendar_id,
      eventId: event.id,
      requestBody: event,
    })
    gcal_user_event_id = data.id
    delete event.attendees
  }

  const { data } = await (await getClient()).calendar.events.insert({
    calendarId: process.env.CALENDAR_ID,
    requestBody: event,
  })

  return { gcal_upframe_event_id: data.id, gcal_user_event_id }
}

export async function deleteMeetup(slot: Slots, mentor: Mentor) {
  await Promise.all([
    (await getClient()).calendar.events.delete({
      calendarId: process.env.CALENDAR_ID,
      eventId: slot.meetups.gcal_upframe_event_id,
      sendUpdates: mentor.google_refresh_token ? 'none' : 'all',
    }),
    mentor.google_calendar_id &&
      (
        await getClient(mentor.id, mentor.google_refresh_token)
      ).calendar.events.delete({
        calendarId: mentor.google_calendar_id,
        eventId: slot.meetups.gcal_user_event_id,
        sendUpdates: 'all',
      }),
  ])
}

export const generateAuthUrl = async () =>
  await authUrl(['https://www.googleapis.com/auth/calendar'])
