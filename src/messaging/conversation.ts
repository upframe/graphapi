import crypto from 'crypto'
import * as db from './db'

export default class Conversation {
  private constructor(
    public readonly id: string,
    public readonly participants: string[],
    public readonly channels: string[]
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
    const con = await db.getConversation(conversationId)
    return con
      ? new Conversation(conversationId, con.participants, con.values)
      : null
  }

  public static async getUserConversations(
    userId: string
  ): Promise<Conversation[]> {
    const res = await db.getUserConversations(userId)

    return res.map(
      ({ sk, participants, channels }) =>
        new Conversation(
          sk.replace(db.prefix.conversation(), ''),
          [...participants, userId],
          channels
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
