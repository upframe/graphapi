import { google, calendar_v3 } from 'googleapis'
import { Meetups, User } from './models'

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
      const { googleRefreshToken } = await User.query()
        .select('googleRefreshToken', 'googleAccessToken')
        .findById(userId)
      if (!googleRefreshToken)
        throw new Error(`no tokens available for ${userId}`)
      refreshToken = googleRefreshToken
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
  meetup: Meetups,
  mentor: User,
  mentee: User,
  eventId: string
): Promise<string> {
  const event = {
    id: eventId.replace(/[^\w]/g, ''),
    summary: `Upframe Meetup ${mentor.name.split(' ')[0]} & ${
      mentee.name.split(' ')[0]
    }`,
    location: meetup.location,
    description: `
    Upframe Mentoring Call
    
    <b>Mentor</b>: <a href="https://upframe.io/${mentor.keycode}">${mentor.name}</a>
    <b>Mentee</b>: ${mentee.name}

    You can join the call on <a href="${meetup.location}">talky.io</a>.
    <blockquote>${meetup.message}</blockquote>
    `,
    start: {
      dateTime: meetup.start,
      timeZone: 'Europe/Berlin',
    },
    end: {
      dateTime: new Date(
        new Date(meetup.start).getTime() + 30 * 60 * 1000
      ).toISOString(),
      timeZone: 'Europe/Berlin',
    },
    transparency: 'opaque',

    attendees: [
      ...(mentor.upframeCalendarId
        ? []
        : [{ email: mentor.email, displayName: mentor.name }]),
      { email: mentee.email, displayName: mentee.name },
    ],
  }

  if (mentor.upframeCalendarId) {
    await (
      await getClient(mentor.id, mentor.googleRefreshToken)
    ).calendar.events.patch({
      calendarId: mentor.upframeCalendarId,
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

export async function deleteMeetup(meetup: Meetups, user: User) {
  const ops: Promise<any>[] = [
    (await getClient()).calendar.events.delete({
      calendarId: process.env.CALENDAR_ID,
      eventId: meetup.mid,
      sendUpdates: 'all',
    }),
  ]

  if (user.upframeCalendarId)
    ops.push(
      (await getClient(user.id, user.googleRefreshToken)).calendar.events.patch(
        {
          calendarId: user.upframeCalendarId,
          eventId: meetup.sid.replace(/[^\w]/g, ''),
          requestBody: {
            summary: 'Upframe Slot',
            description: '',
            attendees: [],
            transparency: 'transparent',
          },
        }
      )
    )

  await Promise.all(ops)
}

export const generateAuthUrl = async () =>
  (await getClient()).auth.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/calendar',
    prompt: 'consent',
  })
