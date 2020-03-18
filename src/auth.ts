import jwt from 'jsonwebtoken'
import { User } from './models'
import * as bcrypt from 'bcrypt'

export function authenticate(token: string): { id: string; role: string } {
  if (!token) return
  try {
    return jwt.verify(token, process.env.PUBLIC_KEY) as any
  } catch (e) {
    if (e instanceof jwt.JsonWebTokenError) return
    throw e
  }
}

export function signIn(user: User, password: string): string {
  if (!user?.email || !checkPassword(user, password)) return
  return jwt.sign({ id: user.id, role: user.role }, process.env.PRIVATE_KEY, {
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

export const cookie = (name: string, value: string, age = 60 ** 2 * 24 * 14) =>
  `${name}=${value}; HttpOnly;${
    !process.env.IS_OFFLINE ? 'Domain=upframe.io; Secure;' : ''
  } SameSite=Lax; Max-Age=${age}`
