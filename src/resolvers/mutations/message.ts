import resolver from '../resolver'
import Channel from '~/messaging/channel'
import Room from '~/messaging/room'
import { UserInputError } from '~/error'
import { User } from '~/models'
import token from '~/utils/token'
import logger from '~/logger'

export const sendMessage = resolver<void>().loggedIn(
  async ({ args: { content, channel }, ctx: { id } }) =>
    void (await new Channel(channel).publish({ author: id, content }))
)

export const createMsgRoom = resolver<User>().loggedIn(
  async ({ args: { participants, msg }, ctx: { id }, query }) => {
    const room = await Room.create(id, ...participants)
    logger.info(room)
    if (!room) throw new UserInputError('room already exists')

    if (msg) {
      const channel = await new Channel(token()).create(room.id)
      logger.info(channel)
      await channel.publish({ author: id, content: msg })
    }

    return await query().findById(id)
  }
)
