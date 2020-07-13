import resolver from '../resolver'
import Channel from '~/messaging/channel'
import Room from '~/messaging/room'
import { UserInputError } from '~/error'
import token from '~/utils/token'
import logger from '~/logger'

export const sendMessage = resolver<any>().loggedIn(
  async ({ args: { content, channel }, ctx: { id } }) =>
    await new Channel(channel).publish({ author: id, content })
)

export const createConversation = resolver<any>().loggedIn(
  async ({ args: { participants, msg }, ctx: { id } }) => {
    participants = Array.from(new Set([id, ...participants]))
    const channelId = ((Date.now() / 1000) | 0) + token().slice(0, 4)
    const room = await Room.create(channelId, ...participants)
    if (!room) throw new UserInputError('room already exists')

    if (msg) {
      const channel = await new Channel(channelId).create(room.id)
      await channel.publish({ author: id, content: msg })
    }

    return room
  }
)

export const createThread = resolver<any>().loggedIn(
  async ({ args: { conversationId, msg }, ctx: { id } }) => {
    const channel = await new Channel(
      ((Date.now() / 1000) | 0) + token().slice(0, 4)
    ).create(conversationId)
    if (msg) await channel.publish({ author: id, content: msg })
    logger.info(channel)
    return { id: channel.channelId }
  }
)
