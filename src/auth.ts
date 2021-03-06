import jwt from 'jsonwebtoken'
import * as bcrypt from 'bcrypt'
import { User } from './models'
import fs from 'fs'

const [PUBLIC_KEY, PRIVATE_KEY] = (() => {
  if (process.env.PUBLIC_KEY && process.env.PUBLIC_KEY !== 'undefined')
    return [process.env.PUBLIC_KEY, process.env.PRIVATE_KEY]
  if (!fs.existsSync('jwt.key') || !fs.existsSync('jwt.key.pub'))
    throw Error("couldn't find rsa key in env or file")
  logger.info('read jwt key from file')
  return [
    fs.readFileSync('jwt.key.pub', 'utf-8'),
    fs.readFileSync('jwt.key', 'utf-8'),
  ].map(v => v.replace(/\\n/gm, '\n'))
})()

export function decode(token: string) {
  if (!token) return
  try {
    return jwt.verify(token, PUBLIC_KEY) as any
  } catch (e) {
    logger.error(e)
    if (e instanceof jwt.JsonWebTokenError) return
    throw e
  }
}

export const signInToken = (user: User): string =>
  jwt.sign({ id: user.id, role: user.role }, PRIVATE_KEY, {
    issuer: 'upframe',
    subject: user.email,
    algorithm: 'RS256',
    expiresIn: '14d',
  })

export const msgToken = (user: User): string =>
  jwt.sign({ user: `msg:${user.id}`, role: user.role }, PRIVATE_KEY, {
    issuer: 'upframe',
    subject: user.email,
    algorithm: 'RS256',
    expiresIn: '1d',
  })

export const checkPassword = (input: string, password: string): boolean =>
  input && password ? bcrypt.compareSync(input, password) : false

export const hashPassword = (password: string): string =>
  bcrypt.hashSync(password, bcrypt.genSaltSync(10))

export const cookie = (name: string, value: string, age = 60 ** 2 * 24 * 14) =>
  `${name}=${value}; HttpOnly;${
    !process.env.IS_OFFLINE ? 'Domain=upframe.io; Secure;' : ''
  } SameSite=Lax; Max-Age=${age}`
