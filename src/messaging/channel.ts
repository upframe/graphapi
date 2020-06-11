import { ddb } from '~/utils/aws'
import type { Optional } from '~/utils/types'
import { assert } from 'console'
const crypto = require('crypto')
import logger from '~/logger'

export default class Channel {
  constructor(public readonly channelId: string) {}

  public async publish({
    time = Date.now(),
    id = time.toString(36) +
      crypto
        .randomBytes(3)
        .toString('hex')
        .match(/.{2}/g)
        .map(v => parseInt(v, 16).toString(36))
        .join(''),
    ...rest
  }: Optional<Omit<Message, 'channel'>, 'time' | 'id'>) {
    await ddb
      .put({
        TableName: 'messages',
        Item: { channel: this.channelId, id, time, ...rest },
      })
      .promise()
  }

  public async read(
    opts: ForwardPageOpt | BackwardPageOpt
  ): Promise<{ messages: Message[]; hasNextPage: boolean }> {
    const dir = 'first' in opts || 'after' in opts ? 'forward' : 'backward'

    assert(
      Object.keys(opts).every(k =>
        (dir === 'forward' ? ['first', 'after'] : ['last', 'before']).includes(
          k
        )
      ),
      "can't mix forward & backward pagination otions"
    )

    const limit =
      (dir === 'forward'
        ? (<ForwardPageOpt>opts).first
        : (<BackwardPageOpt>opts).last) ?? Infinity

    const cursor =
      dir === 'forward'
        ? (<ForwardPageOpt>opts).after
        : (<BackwardPageOpt>opts).before

    const res = await ddb
      .query({
        TableName: 'messages',
        KeyConditionExpression: 'channel = :ch',
        ExpressionAttributeValues: {
          ':ch': this.channelId,
        },
        ScanIndexForward: dir === 'forward',
        Limit: limit + 1,
        ...(cursor && {
          ExclusiveStartKey: {
            channel: this.channelId,
            id: cursor,
          },
        }),
      })
      .promise()

    logger.info(res)

    const items = res.Items.slice(0, limit)

    return {
      messages: (dir === 'forward' ? items : items.reverse()) as Message[],
      hasNextPage: res.Items.length > limit,
    }
  }
}

type ForwardPageOpt = {
  first: number
  after: string
}

type BackwardPageOpt = {
  last: number
  before: string
}

export type Message = {
  id: string
  author: string
  content: string
  time: number
  channel: string
}
