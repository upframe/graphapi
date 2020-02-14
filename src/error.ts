import {
  AuthenticationError,
  ForbiddenError,
  ApolloError,
} from 'apollo-server-lambda'

export const KeycodeError = (msg = 'keycode error') =>
  new ApolloError(msg, 'KEYCODE_ERROR')

export { AuthenticationError, ForbiddenError, ApolloError }
