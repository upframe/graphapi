import { AuthenticationError } from 'apollo-server-lambda'
import { User } from './models'
import { signIn } from './auth'

export default {
  Query: {
    mentors: async () =>
      await User.query()
        .withGraphFetched('profilePictures')
        .where({
          type: 'mentor',
          newsfeed: 'Y',
        }),

    me: async (_, __, { uid }) => {
      if (!uid) throw new AuthenticationError('not logged in')
      return await User.query()
        .withGraphFetched('profilePictures')
        .findById(uid)
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

    profilePictures({ profilePictures, profilePic }) {
      return [
        ...(profilePictures
          ? Object.entries(profilePictures)
              .filter(([k, v]) => v && k.startsWith('pic'))
              .map(([k, v]) => {
                const [, size, type] =
                  k.match(/^pic([0-9]+|Max)(Jpeg|Webp)/) ?? []
                return {
                  ...(size && { size: parseInt(size, 10) || 0 }),
                  ...(type && { type: type.toLowerCase() }),
                  url: v,
                }
              })
          : []),
        ...(profilePic ? [{ url: profilePic }] : []),
      ]
    },
  },
}
