import * as auth from './auth'
import { catchError } from '~/utils/error'
export { oAuth2Client } from './auth'

export const generateAuthUrl = catchError(auth.generateAuthUrl)(
  (error, redirect, ...scopes) => {
    logger.error('error requesting google oauth url', {
      error,
      redirect,
      scopes,
    })
  }
)

export const getTokensFromAuthCode = catchError(
  auth.getTokensFromAuthCode,
  false
)(error => {
  logger.error('error getting tokens from auth code', { error })
})
