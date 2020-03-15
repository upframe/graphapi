import { google, calendar_v3 } from 'googleapis'
import { User, Mentor, Slots } from './models'

const createClient = () =>
  new google.auth.OAuth2(
    process.env.OAUTH_CLIENT_ID,
    process.env.OAUTH_CLIENT_SECRET,
    process.env.IS_OFFLINE
      ? process.env.GCAL_REDIRECT
      : `https://${
          process.env[`GCAL_REDIRECT_${process.env.stage.toUpperCase()}`]
        }`
  )

const clients: {
  [userId: string]: {
    auth: ReturnType<typeof createClient>
    calendar: calendar_v3.Calendar
  }
} = {}

export async function getClient(
  userId: string = 'upframe',
  refreshToken?: string
) {
  if (userId === 'upframe' && !refreshToken)
    refreshToken = process.env.CALENDAR_REFRESH_TOKEN

  if (!(userId in clients)) {
    const auth = createClient()
    if (!refreshToken) {
      const { google_refresh_token } = await Mentor.query()
        .select('google_refresh_token', 'google_access_token')
        .findById(userId)
      if (!google_refresh_token)
        throw new Error(`no tokens available for ${userId}`)
      refreshToken = google_refresh_token
    }
    auth.setCredentials({
      refresh_token: refreshToken,
    })
    clients[userId] = {
      auth,
      calendar: google.calendar({ version: 'v3', auth }),
    }
  }
  return clients[userId]
}

export async function addMeetup(
  slot: Slots,
  mentor: User & Mentor,
  mentee: User
): Promise<string> {
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
      ...(mentor.google_calendar_id
        ? []
        : [{ email: mentor.email, displayName: mentor.name }]),
      { email: mentee.email, displayName: mentee.name },
    ],
  }

  if (mentor.google_calendar_id) {
    await (
      await getClient(mentor.id, mentor.google_refresh_token)
    ).calendar.events.patch({
      calendarId: mentor.google_calendar_id,
      eventId: event.id,
      requestBody: event,
    })
    delete event.attendees
  }

  const { data } = await (await getClient()).calendar.events.insert({
    calendarId: process.env.CALENDAR_ID,
    requestBody: event,
  })

  return data.id
}

export const generateAuthUrl = async () =>
  (await getClient()).auth.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/calendar',
    prompt: 'consent',
  })
