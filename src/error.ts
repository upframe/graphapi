import {
  AuthenticationError,
  ForbiddenError,
  ApolloError,
  UserInputError,
} from 'apollo-server-lambda'

export const handleError = (msg = 'handle error') =>
  new ApolloError(msg, 'handle_ERROR')

export const CredentialsError = (msg = 'invalid credentials') =>
  new ApolloError(msg, 'CREDENTIALS_ERROR')

export { AuthenticationError, ForbiddenError, ApolloError, UserInputError }
