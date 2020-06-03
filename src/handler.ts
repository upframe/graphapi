import tracer from './tracer'
import { datadog } from 'datadog-lambda-js'
import logger from './logger'
import { handler as apolloHandler, requests } from './apollo'
import dbConnect from './db'
import { APIGatewayEvent, Context } from 'aws-lambda'

const handler = async (event: APIGatewayEvent, context: Context) => {
  context.callbackWaitsForEmptyEventLoop = false
  requests[context.awsRequestId] = { responseHeaders: {} }

  logger.setRequestId(context.awsRequestId)

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

export const graphapi = datadog(handler, {
  mergeDatadogXrayTraces: !process.env.IS_OFFLINE,
  logger,
})
