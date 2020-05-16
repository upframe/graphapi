import knex from './db'
import { createClient, google, UserInfo } from './google'
import { UserInputError, InvalidGrantError } from './error'
import { ConnectGoogle } from './models'

export const emailInUse = async (email: string) =>
  await knex('users')
    .where({ email })
    .first()

export const connectGoogle = async (
  code: string,
  redirect: string,
  user_id: string = null
): Promise<Partial<ConnectGoogle> & { info: UserInfo }> => {
  try {
    const client = createClient(redirect)
    const { tokens } = await client.getToken(code)
    client.setCredentials(tokens)
    const { data } = await google
      .oauth2({ auth: client, version: 'v2' })
      .userinfo.get()

    const [emailGone, accountGone] = await Promise.all([
      emailInUse(data.email),
      knex('connect_google')
        .where({ google_id: data.id })
        .first(),
    ])
    if (emailGone)
      if (!user_id || user_id !== emailGone.id)
        throw new UserInputError(`email "${data.email}" already in use`)
    if (accountGone) throw new UserInputError(`google account already in use`)

    const connect = {
      user_id,
      google_id: data.id,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      scopes: ((tokens as any).scope ?? '').split(' '),
    }
    await knex('connect_google').insert(connect)

    return { ...connect, info: data }
  } catch (e) {
    if (e.message === 'invalid_grant') throw InvalidGrantError()
    throw e
  }
}
