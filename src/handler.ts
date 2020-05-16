import tracer from './tracer'
import { datadog } from 'datadog-lambda-js'
import logger from './logger'

import knex from './db'
import { Model } from './models'
Model.knex(knex)
import { handler as apolloHandler, requests } from './apollo'

const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false
  requests[context.awsRequestId] = { responseHeaders: {} }

  logger.setRequestId(context.awsRequestId)

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
