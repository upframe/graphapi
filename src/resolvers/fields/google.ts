import resolver from '../resolver'
import type { ConnectGoogle } from '~/models'
import Client from '~/google/client'

export const connected = resolver<boolean, ConnectGoogle>()(
  ({ parent }) => !!parent
)

export const email = resolver<string, ConnectGoogle>()(async ({ parent }) => {
  const { email } = await Client.fromCreds(parent).userInfo()
  return email
})

export const canDisconnect = resolver<boolean, ConnectGoogle>()(
  async ({ parent, knex }) =>
    !!(await knex('signin_upframe').where({ user_id: parent.user_id }).first())
)
