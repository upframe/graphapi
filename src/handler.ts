import { ApolloServer } from 'apollo-server-lambda'
import typeDefs from './schema.gql'
import resolvers from './resolvers'

const server = new ApolloServer({
  typeDefs: typeDefs,
  resolvers,
  ...(process.env.stage === 'dev' && {
    introspection: true,
    playground: {
      endpoint: `/${process.env.stage}`,
    },
  }),
})

export const graphapi = server.createHandler({
  cors: {
    origin: '*',
    credentials: true,
  },
})
