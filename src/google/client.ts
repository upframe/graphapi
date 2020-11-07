import { google } from 'googleapis'
import type { Credentials } from './auth'
import { getTokensFromAuthCode } from '.'

export default class Client {
  static readonly instances: Client[] = []

  static fromCreds(credentials: Credentials): Client {
    for (const client of Client.instances)
      if (client.credentials.refresh_token === credentials.refresh_token)
        return client.update(credentials)

    const client = new Client(credentials)
    Client.instances.push(client)

    return client
  }

  static async fromAuthCode(code: string, redirect: string) {
    const tokens = await getTokensFromAuthCode(code, redirect)
    if (!tokens) throw new Error('invalid auth code')
    return Client.fromCreds(tokens)
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
  private get credentials() {
    return this._credentials
  }
  private set credentials(creds: Credentials) {
    this._credentials = creds
    this.oAuthClient.setCredentials(creds)
  }

  private _userId: string
  public get userId() {
    return this._userId
  }
  public set userId(id: string) {
    if (!this._userId) {
      this._userId = id
      return
    }
    if (this._userId !== id)
      throw new Error('google client already has user id')
    logger.warn('tried to set user id of google client that already has one', {
      userId: this._userId,
    })
  }

  update(credentials: Credentials): Client {
    if (this.credentials.expiry_date < credentials.expiry_date)
      this.credentials = credentials
    return this
  }

  async userInfo() {
    const { data } = await google
      .oauth2({
        auth: this.oAuthClient,
        version: 'v2',
      })
      .userinfo.get()

    if (data.picture?.endsWith('photo.jpg')) delete data.picture

    return data
  }
}

export type GoogleUserInfo = PromType<ReturnType<Client['userInfo']>>
