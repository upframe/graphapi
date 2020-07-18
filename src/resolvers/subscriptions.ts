import pubsub from '../utils/pubsub'
import Client from '~/messaging/client'
import { decode } from '~/auth'
import { AuthenticationError } from '~/error'
import * as db from '~/messaging/db'

export const message = {
  subscribe: async (
    _,
    { token },
    { connectionId, subscriptionId },
    { rootValue }
  ) => {
    const { user } = decode(token)
    if (!user?.startsWith('msg:'))
      throw new AuthenticationError('invalid message token')

    const { channels } = await db.getUser(user.replace(/^msg:/, ''))

    const { query, variables } = rootValue.payload

    const client = new Client(connectionId)
    await client.subscribe(channels, query, variables, subscriptionId)
    return pubsub.asyncIterator(`MSG_ADDED`)
  },
}

export const channel = {
  subscribe: async (
    _,
    { token },
    { connectionId, subscriptionId },
    { rootValue }
  ) => {
    const { user } = decode(token)
    if (!user?.startsWith('msg:'))
      throw new AuthenticationError('invalid message token')

    const { conversations } = await db.getUser(user.replace(/^msg:/, ''))

    const { query, variables } = rootValue.payload

    const client = new Client(connectionId)

    await client.subscribeChannels(
      conversations,
      query,
      variables,
      subscriptionId
    )
    return pubsub.asyncIterator('CHANNEL_ADDED')
  },
}
