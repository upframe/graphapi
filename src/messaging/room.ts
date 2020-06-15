import { ddb } from '~/utils/aws'
import crypto from 'crypto'

export default class Room {
  private constructor(public readonly id: string) {}

  public static async create(
    channelId: string,
    ...userIds: string[]
  ): Promise<Room> {
    const room = new Room(Room.id(...userIds))
    const participants = ddb.createSet(userIds)
    const channels = ddb.createSet([channelId])
    try {
      const sk = 'meta'
      await ddb
        .put({
          TableName: 'connections',
          Item: { pk: room.key, sk, participants, channels },
          ConditionExpression: 'pk <> :pk AND sk <> :sk',
          ExpressionAttributeValues: {
            ':pk': room.key,
            ':sk': sk,
          },
        })
        .promise()
    } catch (e) {
      if (e.code !== 'ConditionalCheckFailedException') throw e
      return null
    }

    await ddb
      .batchWrite({
        RequestItems: {
          connections: userIds.map(id => ({
            PutRequest: {
              Item: { pk: `USER|${id}`, sk: room.key, participants, channels },
            },
          })),
        },
      })
      .promise()

    return room
  }

  private static id(...ids: string[]) {
    return crypto
      .createHash('sha1')
      .update(Array.from(new Set(ids)).sort().join(''))
      .digest('hex')
      .slice(0, 16)
  }

  private get key() {
    return `ROOM|${this.id}`
  }
}
