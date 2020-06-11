import resolver from '../resolver'
import Channel from '~/messaging/channel'

export const sendMessage = resolver<never>().loggedIn(
  async ({ args: { content, channel }, ctx: { id } }) =>
    void (await new Channel(channel).publish({ author: id, content }))
)
