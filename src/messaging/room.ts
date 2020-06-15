import { ddb } from '~/utils/aws'
import crypto from 'crypto'

export default class Room {
  private constructor() {}

  public static async create(...userIds: string[]): Promise<boolean> {
    const room = `ROOM|${Room.id(...userIds)}`
    const participants = ddb.createSet(userIds)
    try {
      const sk = 'meta'
      await ddb
        .put({
          TableName: 'connections',
          Item: { pk: room, sk, participants },
          ConditionExpression: 'pk <> :pk AND sk <> :sk',
          ExpressionAttributeValues: {
            ':pk': room,
            ':sk': sk,
          },
        })
        .promise()
    } catch (e) {
      if (e.code !== 'ConditionalCheckFailedException') throw e
      return false
    }
    await ddb
      .batchWrite({
        RequestItems: {
          connections: userIds.map(id => ({
            PutRequest: { Item: { pk: `USER|${id}`, sk: room, participants } },
          })),
        },
      })
      .promise()
    return true
  }

  private static id(...ids: string[]) {
    return crypto
      .createHash('sha1')
      .update(Array.from(new Set(ids)).sort().join(''))
      .digest('hex')
      .slice(0, 16)
  }
}
