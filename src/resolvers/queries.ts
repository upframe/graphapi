import { Tags } from '../models'
import query from '../utils/buildQuery'
import { AuthenticationError, handleError, UserInputError } from '../error'
import { generateAuthUrl } from '../gcal'
import knex from '../db'

export default {
  mentors: async (_, __, ___, info) =>
    await query(info, { join: true })
      .select(knex.raw('mentors.score + RANDOM() as rank'))
      .where({
        role: 'mentor',
        listed: true,
      })
      .orderBy('rank', 'DESC'),

  me: async (_, __, { id }, info) => {
    if (!id) throw new AuthenticationError('not logged in')
    return await query(info).findById(id)
  },

  mentor: async (_, { handle, id }, __, info) => {
    if (!id && !handle) throw new UserInputError('must provide handle or id')
    const mentor = await query(info)
      .where(id ? { 'users.id': id } : { handle })
      .first()
    if (!mentor) throw handleError(`can't find mentor ${handle ?? id}`)
    return mentor
  },

  user: async (_, { handle, id }, __, info) => {
    if (!id && !handle) throw new UserInputError('must provide handle or id')
    const user = await query(info)
      .where(id ? { 'users.id': id } : { handle })
      .first()
    if (!user) throw handleError(`can't find user ${handle ?? id}`)
    return user
  },

  calendarConnectUrl: async (_, __, { id }) => {
    if (!id) throw new AuthenticationError('not logged in')
    return await generateAuthUrl()
  },

  tags: async (_, { orderBy }) => {
    let tags = await Tags.query().select('name')
    if (orderBy === 'alpha')
      tags = tags.sort((a, b) => a.name.localeCompare(b.name))
    return tags
  },

  lists: async (_, __, ___, info) => await query(info),
}
