import {
  AuthenticationError,
  ForbiddenError,
  ApolloError,
  UserInputError,
} from 'apollo-server-lambda'

export const handleError = (msg = 'handle error') =>
  new ApolloError(msg, 'KEYCODE_ERROR')

export const CredentialsError = (msg = 'invalid credentials') =>
  new ApolloError(msg, 'CREDENTIALS_ERROR')

export const InvalidGrantError = (msg = 'invalid grant') =>
  new ApolloError(msg, 'INVALID_GRANT')

export const GoogleNotConnectedError = (msg = 'google account not connected') =>
  new ApolloError(msg, 'GOOGLE_NOT_CONNECTED')

export { AuthenticationError, ForbiddenError, ApolloError, UserInputError }
