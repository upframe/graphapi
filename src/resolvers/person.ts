import { SocialMedia } from '../models'

export default {
  __resolveType({ role }) {
    if (role === 'user') return 'User'
    if (role === 'mentor') return 'Mentor'
  },

  social: async ({ socialmedia }, { includeEmpty }) => {
    if (includeEmpty)
      return (await SocialMedia.query()).map(v => ({
        ...v,
        ...socialmedia.find(({ id }) => id === v.id),
      }))
    return socialmedia
  },

  tags: ({ tags = [] }) => tags.map(({ name }) => name),

  notificationPrefs: ({ allow_emails, ...parent }) => ({
    receiveEmails: allow_emails,
    ...parent,
  }),

  profilePictures: ({ profile_pictures }) =>
    profile_pictures ?? [
      {
        url:
          'https://connect-api-profile-pictures.s3.eu-west-2.amazonaws.com/default.png',
      },
    ],
}
