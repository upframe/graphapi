import resolver from '../resolver'
import Channel from '~/messaging/channel'
import type { Message } from '~/messaging/channel'
import * as db from '~/messaging/db'
import { validate, flatten } from '~/utils/pagination'

export const messages = resolver<Connection<Message>, any>()(
  async ({ parent, args }) => {
    validate(args)
    const { cursor } = flatten(args)

    const { messages, hasNextPage } = await new Channel(parent.id).read(args)
    return {
      edges: messages.map(node => ({
        cursor: node.id,
        node,
      })),
      pageInfo: {
        hasNextPage,
        hasPreviousPage: cursor !== undefined,
      },
    }
  }
)

export const conversationId = resolver<string, any>()(
  async ({ parent: { conversationId, id } }) =>
    conversationId ?? (await db.getChannel(id)).conversation
)

export const created = resolver<string, any>()(
  async ({ parent: { id, created } }) => {
    if (!created) {
      const ch = await Channel.get(id)
      created = ch.created
    }
    return new Date(created).toISOString()
  }
)

export const lastUpdate = resolver<string, any>()(
  async ({ parent: { id, lastUpdate } }) => {
    if (!lastUpdate) {
      const ch = await Channel.get(id)
      lastUpdate = ch.created
    }
    return new Date(lastUpdate).toISOString()
  }
)

export const slot = resolver<any, any>()(async ({ parent: { id } }) => {
  let channel = await Channel.get(id)
  if (!channel.slot) channel = await Channel.get(id, true)
  const { slot, participants } = channel
  if (!slot) return
  return {
    ...slot,
    participants,
    time: new Date(slot.time).toISOString(),
  }
})
