import pubsub from '../utils/pubsub'
import Client from '~/messaging/client'
import Conversation from '~/messaging/conversation'
import { decode } from '~/auth'
import { AuthenticationError, ForbiddenError } from '~/error'
import { ddb } from '~/utils/aws'

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

    const { Items } = await ddb
      .query({
        TableName: 'connections',
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER|${user.replace(/^msg:/, '')}`,
        },
      })
      .promise()

    const channels = Items.flatMap(({ channels }) => channels.values)

    const { query, variables } = rootValue.payload

    const client = new Client(connectionId)
    await client.subscribe(channels, query, variables, subscriptionId)
    return pubsub.asyncIterator(`MSG_ADDED`)
  },
}

export const channel = {
  subscribe: async (
    _,
    { token, conversation },
    { connectionId, subscriptionId },
    { rootValue }
  ) => {
    const { user } = decode(token)
    if (!user?.startsWith('msg:'))
      throw new AuthenticationError('invalid message token')

    const room = await Conversation.get(conversation)
    if (!room?.participants?.includes(user.replace(/^msg:/, '')))
      throw new ForbiddenError(`can't subscribe to conversation`)

    const { query, variables } = rootValue.payload

    const client = new Client(connectionId)
    await client.subscribeChannels(
      conversation,
      query,
      variables,
      subscriptionId
    )
    return pubsub.asyncIterator('CHANNEL_ADDED')
  },
}
