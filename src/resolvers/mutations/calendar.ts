import { User, ConnectGoogle } from '../../models'
import { UserInputError } from '../../error'
import resolver from '../resolver'
import { google } from 'googleapis'
import { getTokens, userClient, createClient, UserClient } from '../../google'
import { decode } from 'jsonwebtoken'
import * as account from '../../account'
import { system } from '../../authorization/user'

export const connectCalendar = resolver<User>().loggedIn(
  async ({ query, knex, ctx: { id }, args: { code, redirect } }) => {
    const googleConnect = await query
      .raw(ConnectGoogle)
      .where({
        user_id: id,
      })
      .first()

    let client: UserClient

    if (!googleConnect)
      client = await userClient(
        knex,
        await account.connectGoogle(code, redirect, id, knex)
      )
    else {
      const tokens = await getTokens(code, redirect)

      // check that the same account as the sign in account is used
      client = await userClient(knex, googleConnect)
      const info = await client.userInfo()
      let newMail = tokens.id_token
        ? (decode(tokens.id_token) as any).email
        : undefined
      try {
        if (!newMail && tokens.refresh_token) {
          const newClient = createClient(redirect)
          newClient.setCredentials(tokens)
          newMail = ((await google
            .oauth2({
              auth: newClient,
              version: 'v2',
            })
            .userinfo.get()) as any).email
        }
        if (newMail && info.email !== newMail) throw Error()

        await client.setAccessToken(knex, tokens.access_token)
      } catch (e) {
        throw new UserInputError(
          `Please use your currently connected Google account (${info.email}).`
        )
      }
    }

    const { data } = await client.calendar.calendars.insert({
      requestBody: { summary: 'Upframe' },
    })

    await query
      .raw(ConnectGoogle)
      .where({ user_id: id })
      .patch({ calendar_id: data.id })
      .asUser(system)

    logger.info('google calendar connected', { user: id })

    return await query().findById(id)
  }
)

export const disconnectCalendar = resolver<User>().loggedIn(
  async ({ query, knex, ctx: { id } }) => {
    const user = await query({ include: 'connect_google' }).findById(id)

    if (!user?.connect_google?.calendar_id)
      throw new UserInputError('calendar not connected')

    const client = await userClient(knex, user.connect_google)

    await Promise.all([
      client.calendar.calendars
        .delete({
          calendarId: user.connect_google.calendar_id,
        })
        .catch(console.warn),
      query
        .raw(ConnectGoogle)
        .findById(user.connect_google.google_id)
        .patch({ calendar_id: null })
        .asUser(system),
    ])

    logger.info('google calendar disconnected', { user: id })

    delete user.connect_google.calendar_id
    return user
  }
)
