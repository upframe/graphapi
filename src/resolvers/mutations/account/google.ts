import resolver from '~/resolvers/resolver'
import * as M from '~/models'
import GoogleClient from '~/google/client'
import { UserInputError } from '~/error'

export const connectGoogle = resolver<M.User>().loggedIn(
  async ({ args: { redirect, code }, ctx: { id }, query, knex }) => {
    const client = await GoogleClient.fromAuthCode(code, redirect)
    client.userId = id
    await client.persistLogin()
    return await query().findById(id)
  }
)

export const disconnectGoogle = resolver<M.User>().loggedIn(
  async ({ ctx: { id, user }, query }) => {
    if (!(await query.raw(M.SigninUpframe).findById(user.email).first()))
      throw new UserInputError('must first set account password')
    const client = await GoogleClient.fromUserId(id)
    await client?.revoke()
    return await query().findById(id)
  }
)
