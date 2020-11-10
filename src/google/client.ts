import { google } from 'googleapis'
import type { Credentials } from './auth'
import { getTokensFromAuthCode } from '.'
import { catchInvalid } from './util'

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

  private constructor(credentials: Credentials) {
    logger.debug('create google client', credentials)
    this.credentials = credentials
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

  public async persistLogin() {
    const { id, email, name, picture } = await this.userInfo()
    logger.info('persist google login', { id })
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
    await this.oAuthClient.revokeToken(
      this.credentials.refresh_token ?? this.credentials.access_token
    )
    if (this.userId)
      await Client.db('connect_google').where({ user_id: this.userId }).delete()
  }

  private async syncCredentials() {
    if (!this.userId) return
    if (!Client.db)
      return void logger.warn(
        "didn't write Google credentials to DB because Client.db isn't set"
      )
    logger.debug('sync google credentials for ' + this.userId)
    try {
      await Client.db('connect_google')
        .where({ user_id: this.userId })
        .update({
          refresh_token: this.credentials.refresh_token ?? undefined,
          access_token: this.credentials.access_token,
          scopes: this.credentials.scope?.split(' '),
        })
    } catch (error) {
      logger.error('failed to write Google credentials to db', {
        userId: this.userId,
        error,
      })
    }
  }

  private get credentials() {
    return this._credentials
  }
  private set credentials(creds: Credentials) {
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
}

export type GoogleUserInfo = PromType<ReturnType<Client['userInfo']>>
