import resolver from '../resolver'
import Channel from '~/messaging/channel'
import Room from '~/messaging/room'
import { UserInputError } from '~/error'

export const sendMessage = resolver<void>().loggedIn(
  async ({ args: { content, channel }, ctx: { id } }) =>
    void (await new Channel(channel).publish({ author: id, content }))
)

export const createMsgRoom = resolver<void>().loggedIn(
  async ({ args: { participants }, ctx: { id } }) => {
    if (!(await Room.create(id, ...participants)))
      throw new UserInputError('room already exists')
  }
)
