import resolver from '../resolver'
import type { User } from '~/models'

export const __resolveType = resolver<string, any>()(({ parent: { role } }) =>
  role === 'user'
    ? 'UserNotificationPreferences'
    : 'MentorNotificationPreferences'
)
