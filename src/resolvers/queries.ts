import { User, Tags, List } from '../models'
import { handleError, UserInputError } from '../error'
import { generateAuthUrl } from '../gcal'
import knex from '../db'
import resolver from './resolver'

export const me = resolver<User>().loggedIn(
  async ({ query, ctx: { id } }) => await query().findById(id)
)

export const mentors = resolver<User>()(
  async ({ query }) =>
    await query({ join: true, include: 'mentors' })
      .select(knex.raw('mentors.score + RANDOM() as rank'))
      .where({
        listed: true,
      })
      .andWhere(function() {
        this.whereIn('role', ['mentor', 'admin'])
      })
      .orderBy('rank', 'DESC')
)

export const mentor = resolver<User>()(
  async ({ query, args: { id, handle } }) => {
    if (!id && !handle) throw new UserInputError('must provide handle or id')
    const mentor = await query()
      .where(id ? { 'users.id': id } : { handle })
      .first()
    if (!mentor) throw handleError(`can't find mentor ${handle ?? id}`)
    return mentor
  }
)

export const user = resolver<User>()(
  async ({ query, args: { id, handle } }) => {
    if (!id && !handle) throw new UserInputError('must provide handle or id')
    const user = await query()
      .where(id ? { 'users.id': id } : { handle })
      .first()
    if (!mentor) throw handleError(`can't find user ${handle ?? id}`)
    return user
  }
)

export const calendarConnectUrl = resolver<string>().loggedIn(
  async () => await generateAuthUrl()
)

export const tags = resolver<Tags>()(async ({ query, args: { orderBy } }) => {
  let tags = await query().select('name')
  if (orderBy === 'alpha')
    tags = tags.sort((a, b) => a.name.localeCompare(b.name))
  return tags
})

export const lists = resolver<List>()(async ({ query }) => await query())

export const list = resolver<List>()(
  async ({ query, args: { name } }) =>
    await query({ join: true, include: 'users.mentors' })
      .where({ 'lists.name': name })
      .andWhere(function() {
        this.where({ listed: true }).orWhereNull('listed')
      })
      .first()
)
