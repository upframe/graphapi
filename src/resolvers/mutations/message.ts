import resolver from '../resolver'
import { dynamodb } from '~/utils/aws'

export const sendMessage = resolver<any>()(
  async ({ args: { content, channel }, ctx: { id } }) => {
    await dynamodb
      .put({
        TableName: 'messages',
        Item: {
          channel,
          time: Date.now(),
          from: id,
          content,
        },
      })
      .promise()
  }
)
