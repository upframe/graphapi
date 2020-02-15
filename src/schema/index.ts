import types from './types.gql'
import queries from './queries.gql'
import mutations from './mutations.gql'

export default [
  types,
  queries,
  mutations,
  `schema {
    query: Query
    mutation: Mutation
  }`,
]
