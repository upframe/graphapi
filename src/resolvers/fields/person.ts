import resolver from '../resolver'
import { SocialMedia, User } from '../../models'

export const __resolveType = resolver<string, any>()(({ parent: { role } }) => {
  if (role !== 'user') return 'Mentor'
  return 'User'
})

export const social = resolver<any[], User>()(
  async ({ parent: { socialmedia = [] }, args: { includeEmpty } }) => {
    if (includeEmpty)
      return (await SocialMedia.query()).map(v => ({
        ...v,
        ...socialmedia.find(({ id }) => id === v.id),
      }))
    return socialmedia
  }
)

export const tags = resolver<any[], User>()(({ parent: { role, tags = [] } }) =>
  role === 'user' ? null : tags.map(({ name }) => name)
)

export const notificationPrefs = resolver<any, User>()(
  ({ parent: { allow_emails, ...parent } }) => ({
    receiveEmails: allow_emails,
    ...parent,
  })
)

export const profilePictures = resolver<any[], User>()(
  ({ parent: { profile_pictures } }) =>
    profile_pictures?.length
      ? profile_pictures
      : [
          {
            url:
              'https://connect-api-profile-pictures.s3.eu-west-2.amazonaws.com/default.png',
          },
        ]
)

export const categories = resolver<
  any[],
  User
>()(({ parent: { lists = [] } }) => lists.map(({ name }) => name))

export const role = resolver<string, User>()(({ parent: { role } }) =>
  role.toUpperCase()
)
