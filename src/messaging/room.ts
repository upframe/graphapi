import { ddb } from '~/utils/aws'
import crypto from 'crypto'

export default class Room {
  private constructor(
    public readonly id: string,
    public readonly participants?: string[],
    public readonly channels?: string[]
  ) {}

  public static async create(
    channelId: string,
    ...userIds: string[]
  ): Promise<Room> {
    const channels = ddb.createSet([channelId])
    const room = new Room(Room.id(...userIds), userIds as string[], [channelId])
    const participants = ddb.createSet(userIds)
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

  public static async get(roomId: string): Promise<Room> {
    const { Item } = await ddb
      .get({
        TableName: 'connections',
        Key: { pk: `ROOM|${roomId}`, sk: 'meta' },
      })
      .promise()

    return Item
      ? new Room(roomId, Item.participants.values, Item.channels.values)
      : null
  }

  public static async getUserRooms(userId: string): Promise<Room[]> {
    const { Items } = await ddb
      .query({
        TableName: 'connections',
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER|${userId}`,
        },
      })
      .promise()

    return Items.filter(({ sk }) => sk.startsWith('ROOM|')).map(
      ({ sk, participants, channels }) =>
        new Room(
          sk.replace(/^ROOM\|/, ''),
          participants.values,
          channels.values
        )
    )
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
