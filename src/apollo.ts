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
import logger from './logger'

export const requests = {}

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
  inheritResolversFromInterfaces: true,
})

export const server = new ApolloServer({
  schema,
  context: ({ event, context }): ResolverCtx => {
    const { id, role } =
      authenticate(
        parseCookies(event.headers?.Cookie ?? event.headers?.cookie).auth
      ) ?? {}
    const roles = role?.split('.').map(v => v.trim()) ?? []
    const user = new AuthUser(id)
    user.groups = roles.length ? roles : ['visitor']
    const requestId = context.awsRequestId
    return {
      id,
      user,
      roles,
      requestId,
      clientIp: event.requestContext.identity.sourceIp,
      setHeader(header, value) {
        requests[requestId].responseHeaders[header] = value
      },
      knex: requests[requestId].knex,
    }
  },
  debug: !!process.env.IS_OFFLINE,
  formatError: err => {
    if (err.extensions?.code === 'NOT_LOGGED_IN' && err.path?.includes('me'))
      return err
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
      err.extensions?.exception?.name === 'DBError'
    ) {
      err.message = null
    }
    if (
      /^(select|update|insert|delete|create|drop)\s/i.test(err.message.trim())
    )
      err.message = /^[\w\s]+$/.test(err.message.split('-').pop())
        ? err.message.split('-').pop()
        : null

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
        requests[context.requestId].opName = operationName
        const headers = Object.fromEntries(request.headers)
        logger.info('request', {
          origin: headers.origin,
          userAgent: headers['user-agent'],
          ip: context.clientIp,
          requestId: context.requestId,
          opName: operationName,
          user: context.id,
          roles: (context.roles ?? []).join(', '),
        })
      },
    }),
  ],
})

export const handler = server.createHandler({
  cors: {
    origin:
      process.env.stage !== 'prod'
        ? 'https://beta.upframe.io'
        : 'https://upframe.io',
    credentials: true,
  },
})
