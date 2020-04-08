import { User, Tags, List, Tokens } from '../models'
import { handleError, UserInputError } from '../error'
import { generateAuthUrl } from '../gcal'
import knex from '../db'
import resolver from './resolver'
import { system } from '../authorization/user'
import levenshtein from 'fast-levenshtein'
import _ from 'lodash'
import { filterKeys } from '../utils/object'

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
    if (!user) throw handleError(`can't find user ${handle ?? id}`)
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

export const isTokenValid = resolver<boolean>()(
  async ({ args: { token: tokenId }, ctx: { id }, query }) => {
    const token = await query
      .raw(Tokens)
      .findById(tokenId)
      .asUser(system)
    return id && id !== token.subject ? false : !!token
  }
)

export const search = resolver<any>()(async ({ args: { term, maxUsers } }) => {
  term = term.toLowerCase()

  let usersRaw = await knex('users')
    .select(
      'users.id',
      'name',
      'handle',
      'role',
      'score',
      'url',
      'size',
      'type'
    )
    .leftJoin('mentors', { 'users.id': 'mentors.id' })
    .leftJoin('profile_pictures', { 'users.id': 'profile_pictures.user_id' })
    .whereNot('role', 'nologin')
    .where(
      'name_normalized',
      'ilike',
      knex.raw(`('%' || unaccent('${term}') || '%')`)
    )

  usersRaw = _(usersRaw)
    .groupBy('id')
    .values()
    .value()
    .flatMap(list =>
      list.slice(1).reduce(
        (a, c) => ({
          ...a,
          profile_pictures: [
            ...a.profile_pictures,
            filterKeys(c, ['url', 'size', 'type']),
          ],
        }),
        {
          ...filterKeys(list[0], k => !['url', 'size', 'type'].includes(k)),
          profile_pictures: [filterKeys(list[0], ['url', 'size', 'type'])],
        }
      )
    )
    .map(({ profile_pictures, ...user }) => ({
      ...user,
      profile_pictures: profile_pictures.filter(({ size }) => size),
    }))

  let [users, mentors] = _.partition(usersRaw, { role: 'user' }).map(list =>
    list
      .map(user => ({
        ...user,
        dist: levenshtein.get(term, user.name.toLowerCase()),
      }))
      .sort((a, b) => a.dist - b.dist)
  )

  mentors = _(mentors)
    .groupBy('dist')
    .values()
    .value()
    .map(set => set.sort((a: any, b: any) => b.score - a.score))
    .flat()

  users = [mentors, users].flat()

  console.log(users.map(({ id, profile_pictures, ...user }) => user))

  users = users.slice(0, maxUsers)

  return {
    users,
  }
})
