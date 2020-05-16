import crypto from 'crypto'

export default () => {
  let token
  do {
    token = crypto
      .randomBytes(9)
      .toString('base64')
      .replace(/[^\w]|=+$/g, '')
  } while (token.length < 12)
  return token
}
