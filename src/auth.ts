import jwt from 'jsonwebtoken'
import { User } from './models'
import * as bcrypt from 'bcrypt'

export function authenticate(token: string): string {
  if (!token) return
  try {
    const payload = jwt.verify(token, process.env.PUBLIC_KEY) as any
    return payload.uid
  } catch (e) {
    if (e instanceof jwt.JsonWebTokenError) return
    throw e
  }
}

export function signIn(user: User, password: string): string {
  if (!user?.email || !checkPassword(user, password)) return
  return jwt.sign({ uid: user.id }, process.env.PRIVATE_KEY, {
    issuer: 'upframe',
    subject: user.email,
    algorithm: 'RS256',
    expiresIn: '14d',
  })
}

export const checkPassword = (user: User, password: string): boolean =>
  !user?.password || !password || !bcrypt.compareSync(password, user.password)
    ? false
    : true

export const hashPassword = (password: string): string =>
  bcrypt.hashSync(password, bcrypt.genSaltSync(10))
