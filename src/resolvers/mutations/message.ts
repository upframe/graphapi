import resolver from '../resolver'
import Channel from '~/messaging/channel'
import Conversation from '~/messaging/conversation'
import User from '~/messaging/user'
import { UserInputError, AuthenticationError } from '~/error'
import token from '~/utils/token'
import type { User as UserModel } from '~/models'

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
    await new User(id).markRead(input)
  }
)

export const unsubscribeEmailNotifications = resolver<UserModel>()(
  async ({ args: { token }, ctx: { id }, knex, query }) => {
    const email = await knex('emails').where({ id: token }).first()
    if (!email?.id) throw new UserInputError('invalid unsubscribe token')
    if (email.to_user !== id)
      throw new AuthenticationError('must sign in with correct account')

    const [user] = await Promise.all([
      query().upsertGraphAndFetch({ id, msg_emails: false }),
      new User(id).wantsEmailNotifications(false),
    ])

    return user
  }
)

export const postForUser = resolver<any>()(
  async ({
    args: { content, channel: channelId, email, timestamp },
    ctx: { service },
    knex,
  }) => {
    logger.info({ content, channelId, email })
    if (service !== 'EMAIL') throw new AuthenticationError('must authenticate')
    const channel = await Channel.get(channelId)
    if (!channel?.participants?.length) throw new AuthenticationError('')

    const participants = await knex('users')
      .whereIn('id', channel.participants)
      .select('id', 'email')

    const user = participants.find(
      v => v.email.toLowerCase() === email.toLowerCase()
    )

    if (!user) throw new AuthenticationError('')

    let time = Date.now()
    try {
      if (timestamp) time = new Date(timestamp).getTime()
    } catch (e) {
      logger.warn(`invalid timestamp ${timestamp}`)
    }

    await new Channel(channelId).publish({ author: user.id, content, time })
  }
)
