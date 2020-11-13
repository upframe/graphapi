import { google } from 'googleapis'
import type { Credentials } from './auth'
import { getTokensFromAuthCode } from '.'
import { catchInvalid } from './util'
import axios from 'axios'

export default class Client {
  public static db: DB
  public static readonly tasks: Promise<any>[] = []

  public static fromCreds(credentials: Credentials): Client {
    const client = new Client(credentials)
    const { user_id } = credentials as any
    if (user_id) client._userId = user_id
    return client
  }

  public static async fromAuthCode(
    code: string,
    redirect: string
  ): Promise<Client> {
    const tokens = await getTokensFromAuthCode(code, redirect)
    if (!tokens) throw new Error('invalid auth code')
    logger.info({ tokens })
    return Client.fromCreds(tokens)
  }

  public static async fromGoogleId(id: string): Promise<Client> {
    if (!id) return
    const creds = await Client.db('connect_google')
      .where({ google_id: id })
      .first()
    if (!creds) return
    return Client.fromCreds(creds)
  }

  public static async fromUserId(id: string): Promise<Client> {
    if (!id) return
    const creds = await Client.db('connect_google')
      .where({ user_id: id })
      .first()
    if (!creds) return
    return Client.fromCreds(creds)
  }

  public static async getAccessToken(
    refresh_token: string
  ): Promise<Partial<Credentials>> {
    logger.debug('manually request new access token for ' + refresh_token)
    try {
      const { data } = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: process.env.OAUTH_CLIENT_ID,
        client_secret: process.env.OAUTH_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token,
      })
      return data
    } catch (error) {
      logger.error('failed to fetch new token', { error })
      throw error
    }
  }

  private constructor(credentials: Credentials) {
    logger.debug('create google client', credentials)
    this.credentials = credentials

    this.oAuthClient.on('tokens', tokens => {
      logger.debug("oAuthClient.on('tokens')", { tokens })
      this.credentials = { ...this.credentials, ...tokens }
    })
  }

  readonly oAuthClient = new google.auth.OAuth2(
    process.env.OAUTH_CLIENT_ID,
    process.env.OAUTH_CLIENT_SECRET
  )

  private _credentials: Credentials
  private _userId: string

  @catchInvalid
  public async userInfo() {
    const { data } = await google
      .oauth2({
        auth: this.oAuthClient,
        version: 'v2',
      })
      .userinfo.get()

    if (data.picture?.endsWith('photo.jpg')) delete data.picture

    return data
  }

  public async getScopes(retry = true): Promise<string[]> {
    if (!this.credentials.refresh_token)
      return (
        (this._credentials as any).scopes ??
        this._credentials.scope?.split(' ') ??
        []
      )
    try {
      const { scopes } = await this.oAuthClient.getTokenInfo(
        this.credentials.access_token
      )
      return scopes
    } catch (error) {
      if (!retry)
        return void logger.error(
          'permanently failed to retreive token scoeps',
          { error }
        )
      this.credentials = {
        ...this.credentials,
        ...(await Client.getAccessToken(this.credentials.refresh_token)),
      }
      return await this.getScopes(false)
    }
  }

  public async persistLogin() {
    const { id, email, name, picture } = await this.userInfo()
    logger.info('persist google login', { id, email })
    await Client.db('connect_google').insert({
      google_id: id,
      refresh_token: this.credentials.refresh_token ?? undefined,
      access_token: this.credentials.access_token,
      scopes: this.credentials.scope?.split(' '),
      user_id: this.userId,
      email,
      name,
      picture,
    })
  }

  public async revoke() {
    logger.debug('revoke google tokens', { client: this })
    try {
      if (this.credentials.refresh_token)
        await this.oAuthClient.revokeToken(this.credentials.refresh_token)
    } catch (error) {
      logger.error("couldn't revoke google tokens", { error, client: this })
    }
    if (this.userId)
      await Client.db('connect_google').where({ user_id: this.userId }).delete()
  }

  public async syncCredentials(userId = this.userId) {
    if (!userId) return
    if (!Client.db)
      return void logger.warn(
        "didn't write Google credentials to DB because Client.db isn't set"
      )
    logger.debug('sync google credentials for ' + userId)
    try {
      await Client.db('connect_google')
        .where({ user_id: userId })
        .update({
          refresh_token: this.credentials.refresh_token ?? undefined,
          access_token: this.credentials.access_token,
          scopes: this.credentials.scope?.split(' '),
        })
    } catch (error) {
      logger.error('failed to write Google credentials to db', {
        userId,
        error,
      })
    }
  }

  public get credentials() {
    return this._credentials
  }
  public set credentials(creds: Credentials) {
    this._credentials = creds
    this.oAuthClient.setCredentials(creds)
    this.syncCredentials()
  }

  public get userId() {
    return this._userId
  }
  public set userId(id: string) {
    if (!this._userId) {
      this._userId = id
      this.syncCredentials()
      return
    }
    if (this._userId !== id)
      throw new Error('google client already has user id')
    logger.warn('tried to set user id of google client that already has one', {
      userId: this._userId,
    })
  }

  public get calendar() {
    return google.calendar({ version: 'v3', auth: this.oAuthClient })
  }
}

export type GoogleUserInfo = PromType<ReturnType<Client['userInfo']>>
