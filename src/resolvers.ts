import { AuthenticationError } from 'apollo-server-lambda'
import { User } from './models'
import { signIn } from './auth'

export default {
  Query: {
    mentors: async () =>
      await User.query().where({ type: 'mentor', newsfeed: 'Y' }),

    me: async (_, __, { uid }) => {
      if (!uid) throw new AuthenticationError('invalid token')
      return await User.query().findById(uid)
    },
  },
  Mutation: {
    signIn: async (_, { input: { email, password } }, { setHeader }) => {
      const [user] = await User.query().where({ email })
      const token = signIn(user, password)
      if (!token) throw new AuthenticationError('invalid credentials')
      setHeader('Set-Cookie', `auth=${token}; HttpOnly`)
      return user
    },
    signOut: () => {},
  },

  Person: {
    __resolveType({ type }) {
      if (type === 'user') return 'User'
      if (type === 'mentor') return 'Mentor'
    },
  },
}
