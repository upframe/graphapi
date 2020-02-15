import {
  AuthenticationError,
  ForbiddenError,
  ApolloError,
  UserInputError,
} from 'apollo-server-lambda'

export const KeycodeError = (msg = 'keycode error') =>
  new ApolloError(msg, 'KEYCODE_ERROR')

export const CredentialsError = (msg = 'invalid credentials') =>
  new ApolloError(msg, 'CREDENTIALS_ERROR')

export { AuthenticationError, ForbiddenError, ApolloError, UserInputError }
