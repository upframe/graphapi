import resolver from '~/resolvers/resolver'
import GoogleClient from '~/google/client'
import * as M from '~/models'
import { UserInputError } from '~/error'

export const connectGCal = resolver<M.User>().isMentor<{
  input: { code: string; redirect: string }
}>(
  async ({
    args: {
      input: { code, redirect },
    },
    ctx: { id },
    query,
    knex,
  }) => {
    const client = await GoogleClient.fromAuthCode(code, redirect)
    const info = await client.userInfo()

    logger.info('connect google calendar', { googleId: info.id })

    const userGoogleSignin = await knex(M.ConnectGoogle.tableName)
      .where({ user_id: id })
      .first()

    if (userGoogleSignin && userGoogleSignin.google_id !== info.id)
      throw new UserInputError(
        `You already have a different Google account connected (${userGoogleSignin.email})`
      )

    const googleSignin = await knex(M.ConnectGoogle.tableName)
      .where({ google_id: info.id })
      .first()

    if (googleSignin) {
      await client.syncCredentials(id)
      if (googleSignin.user_id !== id)
        throw new UserInputError(
          'this google account is already used by another Upframe account'
        )
    } else {
      client.userId = id
      await client.persistLogin()
    }

    logger.info(await client.calendar.calendarList.list())

    return await query().findById(id)
  }
)

export const disconnectGCal = resolver().isMentor(async () => {})
