import {
  ApolloServer,
  makeExecutableSchema,
  UserInputError,
  ForbiddenError,
} from 'apollo-server-lambda'
import resolvers from './resolvers'
import { parseCookies } from './utils/cookie'
import PrivateDirective from './directives/private'
import { authenticate } from './auth'
import typeDefs from './schema'
import { ValidationError } from 'objection'
import { User } from './models'

export const graphapi = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false
  const headers = {}
  const waitFor: Promise<any>[] = []

  const server = new ApolloServer({
    schema: makeExecutableSchema({
      typeDefs,
      // @ts-ignore
      resolvers,
      schemaDirectives: {
        private: PrivateDirective,
      },
      inheritResolversFromInterfaces: true,
    }),
    context: ({ event }) => ({
      uid: authenticate(parseCookies(event.headers.Cookie).auth),
      setHeader(header, value) {
        headers[header] = value
      },
    }),
    debug: !!process.env.IS_OFFLINE,
    formatError: err => {
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
        const googleRefreshToken = decodeURIComponent(
          (Object.fromEntries(
            err.extensions?.exception?.config?.body
              ?.split('&')
              ?.map(v => v.split('=')) ?? []
          ).refresh_token as string) ?? ''
        )
        if (googleRefreshToken)
          waitFor.push(
            User.query()
              .patch({ googleRefreshToken: null, googleAccessToken: null })
              .where({ googleRefreshToken })
          )
        return new ForbiddenError('google oauth access denied')
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
      origin: '*',
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
