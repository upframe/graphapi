import { User } from '../models'
import query from '../utils/buildQuery'
import { AuthenticationError, KeycodeError } from '../error'
import { generateAuthUrl } from '../calendar'

export default {
  mentors: async (_, __, ___, info) =>
    await query(User, info).where({
      type: 'mentor',
      newsfeed: 'Y',
    }),

  me: async (_, __, { uid }, info) => {
    if (!uid) throw new AuthenticationError('not logged in')
    return await query(User, info).findById(uid)
  },

  mentor: async (_, { keycode }, __, info) => {
    const [mentor] = await query(User, info).where({
      keycode,
    })
    if (!mentor) throw KeycodeError(`can't find mentor ${keycode}`)
    return mentor
  },

  calendarConnectUrl: (_, __, { uid }) => {
    if (!uid) throw new AuthenticationError('not logged in')
    return generateAuthUrl()
  },
}
