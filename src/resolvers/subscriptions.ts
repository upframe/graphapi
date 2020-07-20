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
    let { user } = decode(token)
    if (!user?.startsWith('msg:'))
      throw new AuthenticationError('invalid message token')

    user = user.replace(/^msg:/, '')

    const { channels } = await db.getUser(user)

    const { query, variables } = rootValue.payload

    const client = new Client(connectionId)
    await client.subscribe(channels, query, variables, subscriptionId, user)
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
    let { user } = decode(token)
    if (!user?.startsWith('msg:'))
      throw new AuthenticationError('invalid message token')

    user = user.replace(/^msg:/, '')

    const { conversations } = await db.getUser(user)

    const { query, variables } = rootValue.payload

    const client = new Client(connectionId)

    await client.subscribeChannels(
      conversations,
      query,
      variables,
      subscriptionId,
      user
    )
    return pubsub.asyncIterator('CHANNEL_ADDED')
  },
}

export const conversation = {
  subscribe: async (
    _,
    { token },
    { connectionId, subscriptionId },
    { rootValue }
  ) => {
    let { user } = decode(token)
    if (!user?.startsWith('msg:'))
      throw new AuthenticationError('invalid message token')

    user = user.replace(/^msg:/, '')

    const client = new Client(connectionId)
    await client.identify(user)

    const { query, variables } = rootValue.payload
    await client.subscribeConversations(query, variables, subscriptionId, user)

    return pubsub.asyncIterator('CONVERSATION_ADDED')
  },
}
