import { User, Tags } from '../models'
import { AuthenticationError, handleError, UserInputError } from '../error'
import { generateAuthUrl } from '../gcal'
import knex from '../db'

export const me: Resolver = async ({ query, ctx: { id } }) => {
  if (!id) throw new AuthenticationError('not logged in')
  return await query().findById(id)
}

export const mentors: Resolver = async ({ query }) =>
  await query({ join: true, include: { mentors: true } })
    .select(knex.raw('mentors.score + RANDOM() as rank'))
    .where({
      role: 'mentor',
      listed: true,
    })
    .orderBy('rank', 'DESC')

export const mentor: Resolver<User> = async ({
  query,
  args: { id, handle },
}) => {
  if (!id && !handle) throw new UserInputError('must provide handle or id')
  const mentor = await query()
    .where(id ? { 'users.id': id } : { handle })
    .first()
  if (!mentor) throw handleError(`can't find mentor ${handle ?? id}`)
  return mentor
}

export const user: Resolver<User> = async ({ query, args: { id, handle } }) => {
  if (!id && !handle) throw new UserInputError('must provide handle or id')
  const user = await query()
    .where(id ? { 'users.id': id } : { handle })
    .first()
  if (!mentor) throw handleError(`can't find user ${handle ?? id}`)
  return user
}

export const calendarConnectUrl: Resolver = async ({ ctx: { id } }) => {
  if (!id) throw new AuthenticationError('not logged in')
  return await generateAuthUrl()
}

export const tags: Resolver<Tags> = async ({ query, args: { orderBy } }) => {
  let tags = await query().select('name')
  if (orderBy === 'alpha')
    tags = tags.sort((a, b) => a.name.localeCompare(b.name))
  return tags
}

export const lists: Resolver = async ({ query }) => await query()

export const list: Resolver = async ({ query, args: { name } }) =>
  await query({ join: true, include: { users: { mentors: true } } })
    .where({ 'lists.name': name, listed: true })
    .first()
