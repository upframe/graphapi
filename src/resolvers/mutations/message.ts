import resolver from '../resolver'
import Channel from '~/messaging/channel'
import Conversation from '~/messaging/conversation'
import { UserInputError } from '~/error'
import token from '~/utils/token'
import logger from '~/logger'
import * as db from '~/messaging/db'

export const sendMessage = resolver<any>().loggedIn(
  async ({ args: { content, channel }, ctx: { id } }) =>
    await new Channel(channel).publish({ author: id, content })
)

export const createConversation = resolver<any>().loggedIn(
  async ({ args: { participants, msg }, ctx: { id } }) => {
    participants = Array.from(new Set([id, ...participants]))
    const channelId = ((Date.now() / 1000) | 0) + token().slice(0, 4)
    const conversation = await Conversation.create(channelId, ...participants)
    if (!conversation) throw new UserInputError('conversation already exists')

    if (msg) {
      const channel = await new Channel(channelId).create(
        conversation.id,
        participants
      )
      await channel.publish({ author: id, content: msg })
    }

    return conversation
  }
)

export const createThread = resolver<any>().loggedIn(
  async ({ args: { conversationId, msg }, ctx: { id } }) => {
    const channel = await new Channel(
      ((Date.now() / 1000) | 0) + token().slice(0, 4)
    ).create(
      conversationId,
      (await Conversation.get(conversationId)).participants
    )
    if (msg) await channel.publish({ author: id, content: msg })
    logger.info(channel)
    return { id: channel.channelId }
  }
)

export const markRead = resolver<any>().loggedIn(
  async ({ args: { input }, ctx: { id } }) => {
    logger.info(input)
    await db.markRead(id, input)
  }
)
