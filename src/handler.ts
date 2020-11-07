import 'source-map-support/register'
import logger from '~/logger'
import { datadog } from 'datadog-lambda-js'
import { handler as apolloHandler, requests } from './apollo'
import dbConnect from './db'
import type { APIGatewayEvent, Context } from 'aws-lambda'

const handler = async (event: APIGatewayEvent, context: Context) => {
  context.callbackWaitsForEmptyEventLoop = false
  requests[context.awsRequestId] = { responseHeaders: {} }

  logger.setRequestId(context.awsRequestId)

  const { Model } = await import('./models')
  const knex = dbConnect()
  Model.knex(knex)
  requests[context.awsRequestId].knex = knex

  if (process.env.IS_OFFLINE && event.body) {
    const opName = JSON.parse(event.body).operationName
    const half = (process.stdout.columns - opName.length) / 2
    console.log(
      `\n${'-'.repeat(Math.floor(half) - 1)} ${opName} ${'-'.repeat(
        Math.ceil(half) - 1
      )}\n`
    )
  }

  const [error, data] = await new Promise(res =>
    apolloHandler(event, context, (error, body) => {
      body.headers = {
        ...body.headers,
        ...requests[context.awsRequestId].responseHeaders,
      }
      res([error, body])
    })
  )

  knex.removeAllListeners()
  await knex.destroy()

  if (error) throw error
  return data
}

export const graphapi = datadog(handler, {
  logger,
})
