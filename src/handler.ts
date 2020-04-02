import knex from './db'
import { Model, Mentor } from './models'
Model.knex(knex)
import AuthUser from './authorization/user'
import {
  ApolloServer,
  makeExecutableSchema,
  UserInputError,
  ForbiddenError,
} from 'apollo-server-lambda'
import resolvers from './resolvers'
import { parseCookies } from './utils/cookie'
import { authenticate } from './auth'
import typeDefs from './schema'
import { ValidationError } from 'objection'

export const graphapi = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false
  const headers = {}
  const waitFor: Promise<any>[] = []

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
      console.log(err)
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
      if (err.message === 'invalid_grant') {
        const google_refresh_token = decodeURIComponent(
          (Object.fromEntries(
            err.extensions?.exception?.config?.body
              ?.split('&')
              ?.map(v => v.split('=')) ?? []
          ).refresh_token as string) ?? ''
        )
        if (google_refresh_token)
          waitFor.push(
            Mentor.query()
              .patch({ google_refresh_token: null, google_access_token: null })
              .where({ google_refresh_token })
          )
        return new ForbiddenError('google oauth access denied')
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
    ...(process.env.stage === 'dev'
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
    ...(!process.env.IS_OFFLINE && {
      engine: {
        apiKey: process.env.APOLLO_KEY,
        schemaTag: process.env.stage === 'prod' ? 'prod' : 'beta',
      },
    }),
  })

  const handler = server.createHandler({
    cors: {
      origin:
        process.env.stage === 'dev'
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
