import { ddb } from '~/utils/aws'
import type { Optional } from '~/utils/types'
import assert from 'assert'
import crypto from 'crypto'
import logger from '~/logger'
import * as db from './db'
import { render } from './markdown'

export default class Channel {
  private static readonly instances: Channel[] = []

  constructor(
    public readonly channelId: string,
    public participants?: string[],
    public readonly created?: number,
    public readonly lastUpdate?: number
  ) {}

  public static async get(id: string): Promise<Channel> {
    let channel = this.instances.find(({ channelId }) => channelId === id)
    if (channel) return channel
    const res = await db.getChannel(id)
    if (!res) return
    channel = new Channel(id, res.participants, res.created, res.lastUpdate)
    Channel.instances.push(channel)
    return channel
  }

  public async create(
    conversationId: string,
    participants: string[]
  ): Promise<Channel> {
    logger.info(`create channel ${this.channelId} in ${conversationId}`)

    await db.createChannel(conversationId, this.channelId, participants)

    this.participants = participants
    Channel.instances.push(this)

    return this
  }

  public async publish({
    time = Date.now(),
    id = time.toString(36) +
      crypto
        .randomBytes(3)
        .toString('hex')
        .match(/.{2}/g)
        .map(v => parseInt(v, 16).toString(36))
        .join(''),
    author,
    content,
  }: Optional<Omit<Message, 'channel'>, 'time' | 'id'>): Promise<Message> {
    const msg = {
      id,
      time,
      channel: this.channelId,
      author,
      content,
      markup: await render(content),
    }

    await db.publishMessage(msg)

    return msg
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
        TableName: 'conversations',
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': db.prefix.channel(this.channelId),
          ':sk': db.prefix.message(),
        },
        ScanIndexForward: dir === 'forward',
        Limit: limit + 1,
        ...(cursor && {
          ExclusiveStartKey: {
            pk: db.prefix.channel(this.channelId),
            sk: db.prefix.message(cursor),
          },
        }),
      })
      .promise()

    const items = res.Items.slice(0, limit).map(({ pk, sk, ...rest }) => ({
      channel: pk.replace(db.prefix.channel(), ''),
      id: sk.replace(db.prefix.message(), ''),
      ...rest,
    }))

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
