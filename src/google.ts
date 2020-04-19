import { google, calendar_v3 } from 'googleapis'
import { Mentor } from './models'

export const createClient = (redirect?: string) =>
  new google.auth.OAuth2(
    process.env.OAUTH_CLIENT_ID,
    process.env.OAUTH_CLIENT_SECRET,
    redirect
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

export const removeClient = (userId: string) => {
  delete clients[userId]
}

export const scopes = {
  signIn: [
    'https://www.googleapis.com/auth/plus.me',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
  calendar: ['https://www.googleapis.com/auth/calendar'],
}
