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
import { authenticate } from './auth'
import typeDefs from './schema'
import { ValidationError } from 'objection'

const handler = async (event, context) => {
  const span = tracer.startSpan('web.request')
  const scope = tracer.scope()
  context.callbackWaitsForEmptyEventLoop = false

  return scope.activate(span, async () => {
    logger.debug({ scope })

    const headers = {}
    logger.setRequestId(context.awsRequestId)
    let opName: string

    const server = new ApolloServer({
      schema: makeExecutableSchema({
        typeDefs,
        // @ts-ignore
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
        if (
          err.extensions?.code === 'NOT_LOGGED_IN' &&
          err.path?.includes('me')
        )
          return { ...err, status: 403 }
        logger.error(err)

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
                // @ts-ignore
                'schema.polling.enable': false,
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

    const [error, data] = await new Promise(res => {
      handler(event, context, (error, body) => {
        body.headers = {
          ...body.headers,
          ...headers,
        }
        res([error, body])
      })
    })

    span.addTags({ opName })
    span.finish()
    if (error) throw error
    return data
  })
}

export let graphapi
if (process.env.IS_OFFLINE) graphapi = handler
else
  graphapi = datadog(handler, {
    logForwarding: true,
    logger,
    injectLogContext: true,
    debugLogging: true,
    mergeDatadogXrayTraces: true,
  })
