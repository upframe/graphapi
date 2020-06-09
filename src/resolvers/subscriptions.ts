import pubsub from '../utils/pubsub'
import logger from '~/logger'
import Client from '~/messaging/client'

export const message = {
  subscribe: async (_, { channel }, { connectionId }) => {
    logger.info('subscribe ' + channel)
    await new Client(connectionId).subscribe(channel)
    return pubsub.asyncIterator(`MSG_ADDED_${channel}`)
  },
}
