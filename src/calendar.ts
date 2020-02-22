import { google } from 'googleapis'
import { Meetups, User } from './models'

export const auth = new google.auth.OAuth2(
  process.env.OAUTH_CLIENT_ID,
  process.env.OAUTH_CLIENT_SECRET,
  process.env.IS_OFFLINE
    ? process.env.GCAL_RDIRECT
    : `https://${
        process.env[`GCAL_REDIRECT_${process.env.stage.toUpperCase()}`]
      }`
)

auth.setCredentials({
  refresh_token: process.env.CALENDAR_REFRESH_TOKEN,
})

const calendar = google.calendar({ version: 'v3', auth })

export async function addEvent(
  meetup: Meetups,
  mentor: User,
  mentee: User
): Promise<string> {
  const event = {
    summary: `Upframe Meetup w/ ${mentor.name.split(' ')[0]}`,
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
    attendees: [
      { email: mentor.email, displayName: mentor.name },
      { email: mentee.email, displayName: mentee.name },
    ],
  }

  const { data } = await calendar.events.insert({
    auth,
    calendarId: process.env.CALENDAR_ID,
    requestBody: event,
  })

  return data.id
}

export async function deleteEvent(eventId: string) {
  await calendar.events.delete({
    auth,
    calendarId: process.env.CALENDAR_ID,
    eventId,
    sendUpdates: 'all',
  })
}

export const generateAuthUrl = () =>
  auth.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/calendar',
  })
