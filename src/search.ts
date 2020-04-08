import knex from './db'
import levenshtein from 'fast-levenshtein'
import _ from 'lodash'
import { filterKeys } from './utils/object'

const baseQuery = () =>
  knex('users')
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
    .andWhere('size', '<=', 128)

export default async function search(term: string, max: number) {
  let usersRaw = await baseQuery().andWhere(
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

  return {
    users: users.slice(0, max),
    userResults: users.length,
    tags: [],
  }
}
