import crypto from 'crypto'

export default (remove = /[^\w]+/g) => {
  let token: string
  do {
    token = crypto.randomBytes(9).toString('base64').replace(remove, '')
  } while (token.length < 12)
  return token
}
