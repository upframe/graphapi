import tracer from './tracer'
import { datadog } from 'datadog-lambda-js'
import logger from './logger'
import { handler as apolloHandler, requests } from './apollo'
import dbConnect from './db'
import { APIGatewayEvent, Context } from 'aws-lambda'
import { dynamodb, gateway } from './utils/aws'
import uuidv4 from 'uuid/v4'

const handler = async (event: APIGatewayEvent, context: Context) => {
  context.callbackWaitsForEmptyEventLoop = false
  requests[context.awsRequestId] = { responseHeaders: {} }

  logger.setRequestId(context.awsRequestId)

  const body = JSON.parse(event.body)
  if (body.type === 'connection_init') {
    console.log('\n\n== CONNECTION INIT==\n')
    console.log(event)
    await gateway
      .postToConnection({
        ConnectionId: event.requestContext.connectionId,
        Data: JSON.stringify({
          id: uuidv4(),
          type: 'connection_ack',
          payload: {},
        }),
      })
      .promise()
    return { statusCode: 200 }
  }

  const { Model } = await import('./models')
  const knex = dbConnect()
  Model.knex(knex)
  requests[context.awsRequestId].knex = knex

  const span = tracer.startSpan('web.request')
  let res: [any, any]
  try {
    res = await tracer.scope().activate(
      span,
      () =>
        new Promise(res => {
          apolloHandler(event, context, (error, body) => {
            body.headers = {
              ...body.headers,
              ...requests[context.awsRequestId].responseHeaders,
            }
            res([error, body])
          })
        })
    )
  } finally {
    span.addTags({ opName: requests[context.awsRequestId].opName })
    span.finish()
  }
  const [error, data] = res

  knex.removeAllListeners()
  await knex.destroy()

  if (error) throw error
  return data
}

export const graphapi = datadog(
  handler,
  process.env.IS_OFFLINE
    ? {
        mergeDatadogXrayTraces: false,
      }
    : {
        mergeDatadogXrayTraces: true,
        logger,
      }
)

export const wsConnect = async (event: APIGatewayEvent) => {
  console.log(`\n\n\n== WSCONNECT ${event.requestContext.eventType} ==\n\n`)
  if (event.requestContext.eventType === 'CONNECT') {
    try {
      await dynamodb
        .put({
          TableName: 'messaging',
          Item: {
            pk: `CHANNEL|${'GLOBAL'}`,
            sk: `CONNECTION|${event.requestContext.connectionId}`,
          },
        })
        .promise()
    } catch (e) {
      console.error(e)
      throw e
    }
  } else if (event.requestContext.eventType === 'DISCONNECT') {
    await dynamodb
      .delete({
        TableName: 'messaging',
        Key: {
          pk: 'CHANNEL|GLOBAL',
          sk: `CONNECTION|${event.requestContext.connectionId}`,
        },
      })
      .promise()
  }
  return { statusCode: 200 }
}
