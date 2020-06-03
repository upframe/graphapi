import pubsub from '../utils/pubsub'
import logger from '~/logger'
import Client from '~/messaging/client'

export const message = {
  subscribe: async (_, { channel }, { connectionId }) => {
    logger.info('subscribe ' + channel)
    const client = await Client.get(connectionId)
    await client.subscribe(channel)
    return pubsub.asyncIterator(`MSG_ADDED_${channel}`)
  },
}
