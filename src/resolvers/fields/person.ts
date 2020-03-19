import { SocialMedia } from '../../models'

export default {
  __resolveType({ role }) {
    if (role === 'mentor') return 'Mentor'
    return 'User'
  },

  social: async ({ socialmedia }, { includeEmpty }) => {
    if (includeEmpty)
      return (await SocialMedia.query()).map(v => ({
        ...v,
        ...socialmedia.find(({ id }) => id === v.id),
      }))
    return socialmedia
  },

  tags: ({ tags = [], role }) =>
    role === 'user' ? null : tags.map(({ name }) => name),

  notificationPrefs: ({ allow_emails, ...parent }) => ({
    receiveEmails: allow_emails,
    ...parent,
  }),

  profilePictures: ({ profile_pictures }) =>
    profile_pictures?.length
      ? profile_pictures
      : [
          {
            url:
              'https://connect-api-profile-pictures.s3.eu-west-2.amazonaws.com/default.png',
          },
        ],

  categories: ({ lists = [] }) => lists.map(({ name }) => name),

  role: ({ role }) => role.toUpperCase(),
}
