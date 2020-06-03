import { dynamodb } from '~/utils/aws'

export default class Client {
  constructor(public readonly connectionId: string) {}

  public async connect() {
    const pk = `CONNECTION|${this.connectionId}`
    const sk = 'CHANNEL_LIST'
    await dynamodb
      .put({
        TableName: 'messaging',
        Item: {
          pk,
          sk,
          channels: dynamodb.createSet(['GLOBAL']),
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
    const { Item } = await dynamodb
      .get({
        TableName: 'messaging',
        Key: {
          pk: `CONNECTION|${this.connectionId}`,
          sk: 'CHANNEL_LIST',
        },
      })
      .promise()
    await dynamodb
      .batchWrite({
        RequestItems: {
          messaging: [
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

  public async subscribe(channel: string) {
    Promise.all([
      dynamodb
        .put({
          TableName: 'messaging',
          Item: {
            pk: `CHANNEL|${channel}`,
            sk: `CONNECTION|${this.connectionId}`,
          },
        })
        .promise(),

      dynamodb
        .update({
          TableName: 'messaging',
          Key: {
            pk: `CONNECTION|${this.connectionId}`,
            sk: 'CHANNEL_LIST',
          },
          UpdateExpression: 'ADD channels :c',
          ExpressionAttributeValues: {
            ':c': dynamodb.createSet([channel]),
          },
        })
        .promise(),
    ])
  }

  static async get(connectionId: string): Promise<Client> {
    return new Client(connectionId)
  }
}
