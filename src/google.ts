import { google, oauth2_v2, calendar_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library/build/src/auth/oauth2client'
import { ConnectGoogle } from './models'
import knex from './db'
import { GoogleNotConnectedError } from './error'
import logger from './logger'
import { filterKeys } from './utils/object'

export { google }
export type UserInfo = oauth2_v2.Schema$Userinfoplus

export const createClient = (redirect?: string) =>
  new google.auth.OAuth2(
    process.env.OAUTH_CLIENT_ID,
    process.env.OAUTH_CLIENT_SECRET,
    redirect
  )

export const calendar = (client: OAuth2Client) =>
  google.calendar({ version: 'v3', auth: client })
export const oauth = (client: OAuth2Client) =>
  google.oauth2({ auth: client, version: 'v2' })

export const scopes = {
  SIGNIN: [
    'https://www.googleapis.com/auth/plus.me',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
  CALENDAR: ['https://www.googleapis.com/auth/calendar'],
}

export const requestScopes = (redirect: string) => (
  scope: string[] | keyof typeof scopes,
  opts?: Parameters<OAuth2Client['generateAuthUrl']>[0],
  isConnected = false
) => {
  if (!Array.isArray(scope)) scope = scopes[scope]
  const client = createClient(redirect)
  return client.generateAuthUrl({
    access_type: 'offline',
    scope,
    ...(!isConnected && { prompt: 'consent' }),
    ...opts,
    include_granted_scopes: true,
  })
}

export const getTokens = async (code: string, redirect: string) =>
  (await createClient(redirect).getToken(code)).tokens

type Tokens = {
  refresh_token: string
  access_token: string
  id?: string
  google_id?: string
} & Partial<ConnectGoogle>

const userClients: { [userId: string]: UserClient } = {}

export class UserClient {
  private user_id: string
  public google_id: string
  private info: UserInfo
  public calendar: calendar_v3.Calendar
  public ready: Promise<UserClient>
  public calendarId: string

  public client: OAuth2Client

  constructor(userId: string, tokens?: Tokens) {
    if (!userId) throw new Error('must provide user id to get client')
    this.user_id = userId
    this.client = createClient()

    if (tokens?.refresh_token) {
      this.setCreds(tokens)
      this.ready = Promise.resolve(this)
    } else
      this.ready = new Promise(res => {
        knex('connect_google')
          .where({ user_id: userId })
          .first()
          .then(tokens => {
            if (!tokens) throw GoogleNotConnectedError()
            this.setCreds(tokens)
            res(this)
          })
      })

    this.client.on('tokens', async ({ refresh_token, access_token }) => {
      if (this.google_id)
        await knex('connect_google')
          .where({ google_id: this.google_id })
          .update({
            ...(refresh_token && { refresh_token }),
            ...(access_token && { access_token }),
          })
    })
  }

  public async userInfo(): Promise<UserInfo> {
    return (
      this.info ?? (this.info = (await oauth(this.client).userinfo.get()).data)
    )
  }

  public async setAccessToken(access_token) {
    console.log('set new access token')
    this.client.setCredentials({ access_token })
    await knex('connect_google')
      .where({ google_id: this.google_id })
      .update({ access_token })
  }

  private setCreds(tokens: Tokens) {
    this.calendarId = tokens.calendar_id
    this.google_id = tokens.google_id ?? tokens.id
    this.client.setCredentials(tokens)
    userClients[this.user_id] = this
    this.calendar = calendar(this.client)
  }
}

export const userClient = async (info: Partial<ConnectGoogle>) => {
  return (
    userClients.user_id ??
    (await new UserClient(info.user_id, info as Tokens).ready)
  )
}

export const upframeClient = createClient()
upframeClient.setCredentials({
  refresh_token: process.env.CALENDAR_REFRESH_TOKEN,
})

export const signUpInfo = async (
  creds: ConnectGoogle
): Promise<{ name?: string; picture?: string }> => {
  try {
    const client = createClient()
    client.setCredentials(creds)
    const { data } = await google
      .oauth2({ auth: client, version: 'v2' })
      .userinfo.get()
    const picture = !data.picture?.endsWith('photo.jpg')
      ? data.picture
      : undefined
    return {
      name: data.name,
      ...(picture && { picture }),
    }
  } catch (e) {
    logger.error(
      "couldn't get signup info from google",
      filterKeys(creds, ['user_id', 'google_id'])
    )
    return {}
  }
}
