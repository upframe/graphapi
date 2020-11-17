import resolver from '../resolver'
import type { ConnectGoogle } from '~/models'
import GoogleClient from '~/google/client'
import { googleOAuthScopes } from '~/google/scopes'

export const connected = resolver<boolean, ConnectGoogle>()(
  ({ parent }) => parent?.google_id !== undefined
)

export const email = resolver<string, ConnectGoogle>()(
  ({ parent }) => parent?.email
)

export const canDisconnect = resolver<boolean, ConnectGoogle>()(
  async ({ parent, knex }) =>
    !!(
      !parent?.user_id ||
      (await knex('signin_upframe').where({ user_id: parent.user_id }).first())
    )
)

export const gcalGranted = resolver<boolean, ConnectGoogle>()(
  async ({ parent }) => {
    if (!parent) return false
    const client = GoogleClient.fromCreds(parent)
    const scopes = await client.getScopes()
    return googleOAuthScopes.calendar.every(scope => scopes?.includes(scope))
  }
)

export const gcalConnected = resolver<string, ConnectGoogle>()(
  ({ parent }) => parent.calendar_id
)

export const calendars = resolver<any[], ConnectGoogle>()<{ ids?: string[] }>(
  async ({ parent, args: { ids } }) => {
    if (!parent) return
    const client = GoogleClient.fromCreds(parent)
    const { data } = await client.calendar.calendarList.list()
    return (data?.items ?? [])
      .filter(({ id }) => ids?.includes(id) ?? true)
      .map(v => ({ ...v, client }))
  }
)
