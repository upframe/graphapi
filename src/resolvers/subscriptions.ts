import pubsub from '../utils/pubsub'
import Client from '~/messaging/client'
import { decode } from '~/auth'
import { AuthenticationError } from '~/error'
import { ddb } from '~/utils/aws'
import logger from '~/logger'

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

    logger.info('!subscribe')
    logger.info(channels)

    const { query, variables } = rootValue.payload

    const client = new Client(connectionId)
    await Promise.all(
      channels.map(channel =>
        client.subscribe(channel, query, variables, subscriptionId)
      )
    )
    return pubsub.asyncIterator(`MSG_ADDED`)
  },
}
