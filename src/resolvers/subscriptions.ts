import pubsub from '../utils/pubsub'
import Client from '~/messaging/client'

export const message = {
  subscribe: async (_, { channel }, { connectionId }, { rootValue }) => {
    const { query, variables } = rootValue.payload
    await new Client(connectionId).subscribe(channel, query, variables)
    return pubsub.asyncIterator(`MSG_ADDED_${channel}`)
  },
}
