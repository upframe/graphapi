import { createClient, google, UserInfo } from './google'
import { UserInputError, InvalidGrantError } from './error'
import { ConnectGoogle } from './models'
import type { Query } from '~/resolvers/resolver'
import { User, Model } from '~/models'

export const connectGoogle = async (
  code: string,
  redirect: string,
  user_id: string = null,
  knex
): Promise<Partial<ConnectGoogle> & { info: UserInfo }> => {
  try {
    const client = createClient(redirect)
    const { tokens } = await client.getToken(code)
    client.setCredentials(tokens)
    const { data } = await google
      .oauth2({ auth: client, version: 'v2' })
      .userinfo.get()

    const [emailGone, accountGone] = await Promise.all([
      knex('users').where({ email: data.email }).first(),
      knex('connect_google').where({ google_id: data.id }).first(),
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

export const remove = async (id: string, query: Query<Model>) => {
  const gTokens = await query.raw(ConnectGoogle).where({ user_id: id }).first()
  if (gTokens) {
    const client = createClient()
    client.setCredentials(gTokens)
    if (gTokens.calendar_id) {
      try {
        const calendar = google.calendar({ version: 'v3', auth: client })
        await calendar.calendars.delete({
          calendarId: gTokens.calendar_id,
        })
      } catch (e) {
        logger.warn(`couldn't delete calendar ${gTokens.calendar_id}`)
      }
    }
    try {
      await client.revokeToken(gTokens.refresh_token)
    } catch (error) {
      logger.warn(`couldn't revoke refresh token`, { error })
    }
  }
  const { name } = ((await query
    .raw(User)
    .deleteById(id)
    .returning('name')) as unknown) as User
  return name
}
