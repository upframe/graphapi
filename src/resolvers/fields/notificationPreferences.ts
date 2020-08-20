import resolver from '../resolver'

export const __resolveType = resolver<string, any>()(({ parent: { role } }) =>
  role === 'user'
    ? 'UserNotificationPreferences'
    : 'MentorNotificationPreferences'
)
