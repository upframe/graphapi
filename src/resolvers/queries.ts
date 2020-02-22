import { User } from '../models'
import query from '../utils/buildQuery'
import { AuthenticationError, KeycodeError, UserInputError } from '../error'
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

  mentor: async (_, { keycode, id }, __, info) => {
    if (!id && !keycode) throw new UserInputError('must provide keycode or id')
    const mentor = id
      ? await query(User, info).findById(id)
      : (
          await query(User, info).where({
            keycode,
          })
        )[0]
    if (!mentor) throw KeycodeError(`can't find mentor ${keycode ?? id}`)
    return mentor
  },

  calendarConnectUrl: (_, __, { uid }) => {
    if (!uid) throw new AuthenticationError('not logged in')
    return generateAuthUrl()
  },
}
