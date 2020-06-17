import logger from '~/logger'
import { ddb } from '~/utils/aws'
import Client from './client'
import { schema } from '~/apollo'
import { execute, parse } from 'graphql'

export default async function handleMessage(message: Message) {
  logger.info(message)

  const connections = await ddb
    .query({
      TableName: 'connections',
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `CHANNEL|${message.channel}`,
      },
    })
    .promise()
    .then(({ Items }) =>
      Items.filter(({ sk }) => sk.startsWith('CONNECTION')).map(
        ({ sk, query, variables, subscriptionId }) => ({
          id: sk.split('|').pop(),
          query,
          variables,
          subscriptionId,
        })
      )
    )

  const exec = async (query, variableValues): Promise<any> => {
    const res = execute({
      document: parse(query),
      schema,
      variableValues,
      rootValue: { message },
    }) as any
    if (typeof res.then === 'function') return await res
    return res
  }

  await Promise.all(
    connections.map(({ id, query, variables, subscriptionId }) =>
      exec(query, variables).then(res =>
        new Client(id).post(res, subscriptionId)
      )
    )
  )
}

type Message = {
  channel: string
  time: number
  author: string
  content: string
}
