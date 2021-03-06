import crypto from 'crypto'
import * as db from './db'

export default class Conversation {
  private constructor(
    public readonly id: string,
    public readonly participants: string[],
    public readonly channels: string[],
    public readonly created?: number,
    public readonly lastUpdate?: number
  ) {}

  public static async create(
    channelId: string,
    ...userIds: string[]
  ): Promise<Conversation> {
    const conversation = new Conversation(
      Conversation.id(...userIds),
      userIds as string[],
      [channelId]
    )

    await db.createConversation(conversation)

    return conversation
  }

  public static async get(conversationId: string): Promise<Conversation> {
    const {
      participants,
      channels,
      created,
      lastUpdate,
    } = await db.getConversation(conversationId)
    return participants
      ? new Conversation(
          conversationId,
          participants,
          channels,
          created,
          lastUpdate
        )
      : null
  }

  public static async getUserConversations(
    userId: string
  ): Promise<Conversation[]> {
    const user = await db.getUser(userId)
    if (!user) {
      logger.info(`create chat user for ${userId}`)
      await db.createUser(userId)
    }
    if (!user?.conversations?.length) return []
    const res = await db.getConversations(user.conversations)
    return res.map(
      ({ pk, participants, channels, created, lastUpdate }) =>
        new Conversation(
          pk.replace(db.prefix.conversation(), ''),
          participants,
          channels,
          created,
          lastUpdate
        )
    )
  }

  private static id(...ids: string[]) {
    return crypto
      .createHash('sha1')
      .update(Array.from(new Set(ids)).sort().join(''))
      .digest('hex')
      .slice(0, 16)
  }
}
