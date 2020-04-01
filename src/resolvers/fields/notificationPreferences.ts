import resolver from '../resolver'

export const __resolveType = resolver<string, any>()(({ parent: { role } }) =>
  role === 'user'
    ? 'UserNotificationPreferences'
    : 'MentorNotificationPreferences'
)

export const receiveEmails = resolver<boolean, any>()(
  ({ parent: { receiveEmails } }) => receiveEmails
)
