import * as bcrypt from 'bcrypt'
import { AuthenticationError } from 'apollo-server-lambda'
import jwt from 'jsonwebtoken'
import { User } from './models'

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

      if (!user || !bcrypt.compareSync(password, user.password))
        throw new AuthenticationError('invalid credentials')

      const token = jwt.sign({ uid: user.uid }, process.env.PRIVATE_KEY, {
        issuer: 'upframe',
        subject: email,
        algorithm: 'RS256',
        expiresIn: '14d',
      })

      setHeader('Set-Cookie', `auth=${token}; HttpOnly`)

      return user
    },
    signOut: () => {},
  },
}
