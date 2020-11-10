import resolver from '../resolver'
import type { ConnectGoogle } from '~/models'

export const connected = resolver<boolean, ConnectGoogle>()(
  ({ parent }) => parent?.google_id !== undefined
)

export const canDisconnect = resolver<boolean, ConnectGoogle>()(
  async ({ parent, knex }) =>
    !!(
      !parent?.user_id ||
      (await knex('signin_upframe').where({ user_id: parent.user_id }).first())
    )
)
