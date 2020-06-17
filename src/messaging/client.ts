import { ddb, gateway } from '~/utils/aws'
import logger from '~/logger'

export default class Client {
  constructor(public readonly connectionId: string) {}

  public async connect() {
    const pk = `CONNECTION|${this.connectionId}`
    const sk = 'CHANNEL_LIST'
    await ddb
      .put({
        TableName: 'connections',
        Item: {
          pk,
          sk,
          channels: ddb.createSet(['GLOBAL']),
        },
        ConditionExpression: 'pk <> :pk AND sk <> :sk',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': sk,
        },
      })
      .promise()
  }

  public async disconnect() {
    const { Item } = await ddb
      .get({
        TableName: 'connections',
        Key: {
          pk: `CONNECTION|${this.connectionId}`,
          sk: 'CHANNEL_LIST',
        },
      })
      .promise()
    await ddb
      .batchWrite({
        RequestItems: {
          connections: [
            {
              DeleteRequest: {
                Key: {
                  pk: `CONNECTION|${this.connectionId}`,
                  sk: 'CHANNEL_LIST',
                },
              },
            },
            ...Item.channels.values.map(channel => ({
              DeleteRequest: {
                Key: {
                  pk: `CHANNEL|${channel}`,
                  sk: `CONNECTION|${this.connectionId}`,
                },
              },
            })),
          ],
        },
      })
      .promise()
  }

  public async subscribe(
    channel: string,
    query: string,
    variables: any,
    subscriptionId: string
  ) {
    console.log({ subscriptionId })

    Promise.all([
      ddb
        .put({
          TableName: 'connections',
          Item: {
            pk: `CHANNEL|${channel}`,
            sk: `CONNECTION|${this.connectionId}`,
            query,
            variables,
            subscriptionId,
          },
        })
        .promise(),

      ddb
        .update({
          TableName: 'connections',
          Key: {
            pk: `CONNECTION|${this.connectionId}`,
            sk: 'CHANNEL_LIST',
          },
          UpdateExpression: 'ADD channels :c',
          ExpressionAttributeValues: {
            ':c': ddb.createSet([channel]),
          },
        })
        .promise(),
    ])
  }

  public async post(data: any, id) {
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
      logger.info(`disconnecting client ${this.connectionId}`)
      await this.disconnect()
    }
  }
}
