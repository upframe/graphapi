import db from './db'

export default {
  Query: {
    mentors: () =>
      db('users')
        .select('name')
        .where({ type: 'mentor', newsfeed: 'Y' }),

    me: async () => {},
  },
  Mutation: {
    login: () => {},
    logout: () => {},
  },
}
