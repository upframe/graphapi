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
import createLogger from './logger'
const { datadog } = !process.env.IS_OFFLINE
  ? require('datadog-lambda-js')
  : { datadog: handler => handler }
const tracer = !process.env.IS_OFFLINE
  ? require('dd-trace').init({ logInjection: true })
  : { wrap: (_, handler) => (...args) => handler(...args) }

const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false
  const headers = {}
  const waitFor: Promise<any>[] = []
  const logger = createLogger(context.awsRequestId)

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
      if (err.extensions?.code && err.path?.includes('me')) return err
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
          const headers = Object.fromEntries(request.headers)
          logger.info('request', {
            origin: headers.origin,
            userAgent: headers['user-agent'],
            ip: event.requestContext.identity.sourceIp,
            opName: operationName,
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

  return await new Promise((resolve, reject) => {
    const callback = (error, body) => {
      body.headers = { ...body.headers, ...headers }
      Promise.all(waitFor).then(() => (error ? reject(error) : resolve(body)))
    }
    handler(event, context, callback)
  })
}

export const graphapi = datadog(tracer.wrap('graphapi', handler))
