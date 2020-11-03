import { ddb } from '~/utils/aws'
import type { Optional } from '~/utils/types'
import crypto from 'crypto'
import * as db from './db'
import { render } from './markdown'
import type { PaginationArgs } from '~/utils/pagination'
import { validate, flatten } from '~/utils/pagination'

export default class Channel {
  private static readonly instances: Channel[] = []

  constructor(
    public readonly channelId: string,
    public participants?: string[],
    public readonly created?: number,
    public readonly lastUpdate?: number,
    public readonly slot?: Slot
  ) {}

  public static async get(id: string): Promise<Channel> {
    let channel = this.instances.find(({ channelId }) => channelId === id)
    if (channel) return channel
    const res = await db.getChannel(id)
    if (!res) return
    const slot = res.slotId
      ? {
          id: res.slotId,
          time: res.slotTime,
          mentor: res.slotMentor,
          url: res.slotUrl,
        }
      : undefined
    channel = new Channel(
      id,
      res.participants,
      res.created,
      res.lastUpdate,
      slot
    )
    Channel.instances.push(channel)
    return channel
  }

  public async create(
    conversationId: string,
    participants: string[],
    slot?: Slot
  ): Promise<Channel> {
    logger.info(`create channel ${this.channelId} in ${conversationId}`)

    await db.createChannel(conversationId, this.channelId, participants, slot)

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
    suffix = '',
    author,
    content,
  }: Optional<Omit<Message, 'channel'>, 'time' | 'id'> & {
    suffix?: string
  }): Promise<Message> {
    const msg = {
      id: id + suffix,
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
    opts: PaginationArgs
  ): Promise<{ messages: Message[]; hasNextPage: boolean }> {
    validate(opts)
    const { limit, cursor, direction } = flatten(opts)

    const res = await ddb
      .query({
        TableName: 'conversations',
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': db.prefix.channel(this.channelId),
          ':sk': db.prefix.message(),
        },
        ScanIndexForward: direction === 'forward',
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
      messages: (direction === 'forward'
        ? items
        : items.reverse()) as Message[],
      hasNextPage: res.Items.length > limit,
    }
  }
}

export type Message = {
  id: string
  author: string
  content: string
  time: number
  channel: string
}

type Slot = { id: string; url: string; time: number; mentor: string }
