import logger from '~/logger'
import { dynamodb } from '~/utils/aws'
import Client from './client'

export default async function handleMessage(message: Message) {
  logger.info(message)

  const connections = await dynamodb
    .query({
      TableName: 'connections',
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `CHANNEL|${message.channel}`,
      },
    })
    .promise()
    .then(({ Items }) =>
      Items.map(({ sk }) => sk)
        .filter(sk => sk.startsWith('CONNECTION'))
        .map(c => c.split('|').pop())
    )

  await Promise.all(connections.map(id => new Client(id).post(message.content)))
}

type Message = {
  channel: string
  time: number
  sender: string
  content: string
}
