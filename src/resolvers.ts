import db from './db'
import * as bcrypt from 'bcrypt'
import { AuthenticationError } from 'apollo-server-lambda'
import jwt from 'jsonwebtoken'

export default {
  Query: {
    mentors: () => db('users').where({ type: 'mentor', newsfeed: 'Y' }),

    me: async (_, __, { uid }) => {
      if (!uid) throw new AuthenticationError('invalid token')
      const [user] = await db('users').where({ uid })
      return user
    },
  },
  Mutation: {
    signIn: async (_, { input: { email, password } }, { setHeader }) => {
      const [user] = await db('users').select({ email })

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
