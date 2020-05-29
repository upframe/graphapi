import resolver from '../resolver'
import { dynamodb, gateway } from '../../utils/aws'

export const sendMessage = resolver<any>()(async ({ args: { content } }) => {
  const { Items } = await dynamodb
    .query({
      TableName: 'messaging',
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': 'CHANNEL|GLOBAL',
      },
    })
    .promise()

  await Promise.all(
    Items.map(({ sk }) =>
      gateway
        .postToConnection({
          ConnectionId: sk.replace(/CONNECTION\|(.+)/, '$1'),
          Data: JSON.stringify({
            id: 1,
            type: 'data',
            payload: { data: { content } },
          }),
        })
        .promise()
    )
  )
})
