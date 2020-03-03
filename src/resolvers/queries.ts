import { User } from '../models'
import query from '../utils/buildQuery'
import { AuthenticationError, handleError, UserInputError } from '../error'
import { generateAuthUrl } from '../calendar'

export default {
  mentors: async (_, __, ___, info) =>
    await query(User, info, 'visibility')
      .where({
        role: 'mentor',
        listed: true,
      })
      .orderByRaw('RANDOM()'),

  me: async (_, __, { id }, info) => {
    if (!id) throw new AuthenticationError('not logged in')
    return await query(User, info).findById(id)
  },

  mentor: async (_, { handle, id }, __, info) => {
    if (!id && !handle) throw new UserInputError('must provide handle or id')
    let q = query(User, info)
    q = id ? q.findById(id) : q.where({ 'users.handle': handle }).first()
    const mentor = await q
    if (!mentor) throw handleError(`can't find mentor ${handle ?? id}`)
    return mentor
  },

  calendarConnectUrl: async (_, __, { id }) => {
    if (!id) throw new AuthenticationError('not logged in')
    return await generateAuthUrl()
  },
}
