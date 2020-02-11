import { ApolloServer } from 'apollo-server-lambda'
import typeDefs from './schema.gql'
import resolvers from './resolvers'

export const graphapi = async (event, context) => {
  const headers = {}

  const server = new ApolloServer({
    typeDefs: typeDefs,
    resolvers,
    context: () => ({
      setHeader(header, value) {
        headers[header] = value
      },
    }),
    ...(process.env.stage === 'dev' && {
      introspection: true,
      playground: {
        endpoint: process.env.IS_OFFLINE ? '/' : `/${process.env.stage}`,
        settings: {
          'request.credentials': 'same-origin',
          // @ts-ignore
          'schema.polling.enable': false,
        },
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
      return error ? reject(error) : resolve(body)
    }
    handler(event, context, callback)
  })
}
