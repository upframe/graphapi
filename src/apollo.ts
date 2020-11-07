import AuthUser from './authorization/user'
import {
  ApolloServer,
  makeExecutableSchema,
  UserInputError,
} from 'apollo-server-lambda'
import resolvers from './resolvers'
import { parseCookies } from './utils/cookie'
import { decode } from './auth'
import * as typeDefs from './schema'
import { ValidationError } from 'objection'
import { mapKeys } from '~/utils/object'

export const requests = {}

export const schema = makeExecutableSchema({
  typeDefs: Object.values(typeDefs),
  resolvers,
  inheritResolversFromInterfaces: true,
})

export const server = new ApolloServer({
  schema,
  context: ({ event, context }): ResolverCtx => {
    const headers = mapKeys(event.headers ?? {}, k => k.toLowerCase())
    const { id, role, sub } =
      decode(parseCookies(headers.cookie as string).auth) ?? {}
    const roles = role?.split('.').map(v => v.trim()) ?? []
    const user = new AuthUser(id, sub)
    user.groups = roles.length ? roles : ['visitor']
    const requestId = context.awsRequestId
    logger.setUserId(id)

    if (process.env.LOG_REQUEST) {
      const body = JSON.parse(event.body)
      logger.info(
        process.env.LOG_REQUEST === 'full'
          ? body
          : `!${body.operationName ?? 'unknown opName'}`
      )
    }

    return {
      id,
      user,
      roles,
      requestId,
      clientIp:
        event.headers['Client-IP'] ?? event.requestContext.identity.sourceIp,
      setHeader(header, value) {
        requests[requestId].responseHeaders[header] = value
      },
      knex: requests[requestId].knex,
      service:
        headers['service-auth'] &&
        headers['service-auth'] === process.env.EMAIL_SECRET
          ? 'EMAIL'
          : undefined,
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

    if (err.message.includes('arn:aws')) err.message = 'internal error'

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
  engine:
    process.env.stage === 'dev'
      ? {
          apiKey: process.env.APOLLO_KEY,
          graphVariant: 'beta',
        }
      : false,
  plugins: [
    {
      requestDidStart({ request, context }) {
        requests[context.requestId].opName = request.operationName
        if (process.env.IS_OFFLINE) return
        logger.info('request', {
          origin: request.http.headers.get('origin'),
          userAgent: request.http.headers.get('user-agent'),
          ip: context.clientIp,
          requestId: context.requestId,
          opName: request.operationName,
          user: context.id,
          roles: (context.roles ?? []).join(', '),
        })
      },
    },
  ],
})

export const handler = server.createHandler({
  cors: {
    origin: `https://${
      { dev: 'beta.', msg: 'msg.' }[process.env.stage] ?? ''
    }upframe.io`,
    credentials: true,
  },
})
