import { gateway } from '~/utils/aws'
import logger from '~/logger'
import * as db from './db'

export default class Client {
  constructor(public readonly connectionId: string) {}

  public async connect() {
    await db.createClient(this.connectionId)
  }

  public async disconnect() {
    logger.info(`disconnect client ${this.connectionId}`)
    const item = await db.removeClient(this.connectionId)

    if (!item) return

    await Promise.all([
      ...(item.channels?.length
        ? [
            db.unsubscribeClient(
              'messages',
              this.connectionId,
              item.channels,
              true
            ),
          ]
        : []),
      ...(item.conversations?.length
        ? [
            db.unsubscribeClient(
              'channels',
              this.connectionId,
              item.conversations,
              true
            ),
          ]
        : []),
    ])
  }

  public async subscribe(
    channels: string[],
    query: string,
    variables: any,
    subscriptionId: string
  ) {
    logger.info(`subscribe client ${this.connectionId} to ${channels}`)

    await db.subscribeClient(
      'messages',
      this.connectionId,
      channels,
      subscriptionId,
      query,
      variables
    )
  }

  public async subscribeChannels(
    conversations: string[],
    query: string,
    variables: any,
    subscriptionId: string
  ) {
    logger.info(
      `subscribe client ${this.connectionId} to channels in ${conversations}`
    )

    await db.subscribeClient(
      'channels',
      this.connectionId,
      conversations,
      subscriptionId,
      query,
      variables
    )
  }

  public async post(data: any, id: string) {
    logger.info(`post to ${this.connectionId}`)
    try {
      await gateway
        .postToConnection({
          ConnectionId: this.connectionId,
          Data: JSON.stringify({
            id,
            type: 'data',
            payload: data,
          }),
        })
        .promise()
    } catch (e) {
      logger.info(`inactive client ${this.connectionId}`, e)
      await this.disconnect()
    }
  }
}
