import 'source-map-support/register'
import logger from '~/logger'
import { datadog } from 'datadog-lambda-js'
import { handler as apolloHandler, requests } from './apollo'
import dbConnect from './db'
import type { APIGatewayEvent, Context } from 'aws-lambda'
import GoogleClient from '~/google/client'

const handler = async (event: APIGatewayEvent, context: Context) => {
  context.callbackWaitsForEmptyEventLoop = false
  requests[context.awsRequestId] = { responseHeaders: {} }

  logger.setRequestId(context.awsRequestId)

  const { Model } = await import('./models')
  const knex = dbConnect()
  Model.knex(knex)
  GoogleClient.db = knex
  requests[context.awsRequestId].knex = knex

  if (process.env.IS_OFFLINE && event.body) {
    const body = JSON.parse(event.body)
    const opName = body.operationName ?? 'anonymous'
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

  const taskRes: PromiseSettledResult<any>[] | 'timeout' = (await Promise.race([
    Promise.allSettled(GoogleClient.tasks),
    new Promise(res => setTimeout(() => res('timeout'), 1000)),
  ])) as any
  if (taskRes === 'timeout') logger.warn('GoogleClient task timeout')
  else {
    const failed = taskRes
      .map(v => v.status === 'rejected' && v.reason)
      .filter(Boolean)
    if (failed.length) logger.error('GoogleClient tasks failed', { failed })
  }

  knex.removeAllListeners()
  await knex.destroy()

  if (error) throw error
  return data
}

export const graphapi = datadog(handler, {
  logger,
})
