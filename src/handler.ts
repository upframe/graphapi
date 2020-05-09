import tracer from './tracer'
import { datadog } from 'datadog-lambda-js'
import logger from './logger'

import knex from './db'
import { Model } from './models'
Model.knex(knex)
import AuthUser from './authorization/user'
import {
  ApolloServer,
  makeExecutableSchema,
  UserInputError,
} from 'apollo-server-lambda'
import resolvers from './resolvers'
import { parseCookies } from './utils/cookie'
import { authenticate, cookie } from './auth'
import typeDefs from './schema'
import { ValidationError } from 'objection'

const handler = async (event, context) => {
  const headers = {}
  logger.setRequestId(context.awsRequestId)
  let opName: string

  const server = new ApolloServer({
    schema: makeExecutableSchema({
      typeDefs,
      resolvers,
      inheritResolversFromInterfaces: true,
    }),
    context: ({ event }): ResolverCtx => {
      const { id, role } =
        authenticate(
          parseCookies(event.headers?.Cookie ?? event.headers?.cookie).auth
        ) ?? {}
      const roles = role?.split('.').map(v => v.trim()) ?? []
      const user = new AuthUser(id)
      user.groups = roles.length ? roles : ['visitor']
      return {
        id,
        user,
        roles,
        setHeader(header, value) {
          headers[header] = value
        },
      }
    },
    debug:
      event.headers?.debug === process.env.DEV_PASSWORD ||
      !!process.env.IS_OFFLINE,
    formatError: err => {
      if (err.extensions?.code === 'NOT_LOGGED_IN' && err.path?.includes('me'))
        return { ...err, status: 403 }
      logger.error(err)

      if (
        (err.extensions?.exception?.config?.url.includes(
          'googleapis.com/calendar'
        ) &&
          err.message === 'invalid_grant') ||
        err.extensions?.code === 'GOOGLE_ERROR'
      )
        headers['Set-Cookie'] = cookie('auth', 'deleted', -1)

      if (err.originalError instanceof ValidationError) {
        const field = err.message.match(/^(\w+):/)[1]
        return new UserInputError(
          err.message.includes('should match pattern')
            ? `invalid ${field}`
            : err.message,
          {
            field,
          }
        )
      }
      if (
        !process.env.IS_OFFLINE &&
        event.headers?.debug !== process.env.DEV_PASSWORD &&
        err.extensions?.exception?.name === 'DBError'
      ) {
        err.message = null
      }
      return err
    },
    ...(process.env.stage !== 'prod'
      ? {
          introspection: true,
          playground: {
            endpoint: '/',
            settings: {
              'request.credentials': 'same-origin',
            },
          },
        }
      : { introspection: false, playground: false }),
    ...(!process.env.IS_OFFLINE &&
      process.env.stage === 'dev' && {
        engine: {
          apiKey: process.env.APOLLO_KEY,
          schemaTag: 'beta',
        },
      }),
    extensions: [
      () => ({
        requestDidStart({ request, operationName, context }) {
          opName = operationName
          const headers = Object.fromEntries(request.headers)
          logger.info('request', {
            origin: headers.origin,
            userAgent: headers['user-agent'],
            ip: event.requestContext.identity.sourceIp,
            opName,
            user: context.id,
            roles: (context.roles ?? []).join(', '),
          })
        },
      }),
    ],
  })

  const handler = server.createHandler({
    cors: {
      origin:
        process.env.stage !== 'prod'
          ? 'https://beta.upframe.io'
          : 'https://upframe.io',
      credentials: true,
    },
  })

  const span = tracer.startSpan('web.request')
  let res: [any, any]
  try {
    res = await tracer.scope().activate(
      span,
      () =>
        new Promise(res => {
          handler(event, context, (error, body) => {
            body.headers = {
              ...body.headers,
              ...headers,
            }
            res([error, body])
          })
        })
    )
  } finally {
    span.addTags({ opName })
    span.finish()
  }
  const [error, data] = res

  knex.removeAllListeners()

  if (error) throw error
  return data
}

export let graphapi
if (process.env.IS_OFFLINE)
  graphapi = datadog(
    handler,
    process.env.IS_OFFLINE
      ? {
          mergeDatadogXrayTraces: false,
        }
      : { mergeDatadogXrayTraces: true, logger }
  )
else graphapi = datadog(handler)
