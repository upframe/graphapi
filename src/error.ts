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

export { AuthenticationError, ForbiddenError, ApolloError, UserInputError }
