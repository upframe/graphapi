import { dynamodb } from '~/utils/aws'
import type { Optional } from '~/utils/types'

export default class Channel {
  constructor(public readonly channelId: string) {}

  public async publish({
    time = Date.now(),
    ...rest
  }: Optional<Omit<Message, 'channel'>, 'time'>) {
    await dynamodb
      .put({
        TableName: 'messages',
        Item: { time, channel: this.channelId, ...rest },
      })
      .promise()
  }
}

export type Message = {
  author: string
  content: string
  time: number
  channel: string
}
