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

export async function searchUsers(term: string, limit: number, withTags = []) {
  let query = baseQuery()
  if (term?.length)
    query = query.andWhere(
      'name_normalized',
      'ilike',
      knex.raw(`('%' || unaccent('${term}') || '%')`)
    )

  if (withTags?.length)
    query = query
      .innerJoin('user_tags', { 'users.id': 'user_tags.user_id' })
      .whereIn('tag_id', withTags)
      .groupBy('users.id', 'name', 'handle', 'role', 'score', 'url')
      .havingRaw(`count(*) = ${withTags.length}`)

  let usersRaw = await query

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
        dist: levenshtein.get(term ?? '', user.name.toLowerCase()),
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

  return users.slice(0, limit)
}

const tagSelect = () => knex('tags').select('name', 'id')

const tagSearchQuick = async (term: string, limit: number) => {
  return await (term
    ? tagSelect().where('name', 'ilike', `${term}%`)
    : tagSelect()
  )
    .orderByRaw('length(name)')
    .limit(limit)
}

const tagSearchComplex = async (query: string, limit: number, exclude = []) => {
  return await tagSelect()
    .where('name', 'ilike', `%${query}%`)
    .whereNotIn('name', exclude)
    .orderByRaw('length(name)')
    .limit(limit)
}

export const searchTags = async (query: string, limit: number) => {
  let tags = []
  if (query?.length ?? 0 <= 2) tags = await tagSearchQuick(query, limit)
  if (limit - tags.length > 0) {
    tags.push(
      ...(await tagSearchComplex(
        query,
        limit - tags.length,
        tags.map(({ name }) => name)
      ))
    )
    tags = tags
      .map(tag => ({ ...tag, dist: levenshtein.get(query, tag.name) }))
      .sort((a, b) => a.dist - b.dist)
  }
  tags = tags.map(tag => ({ tag }))
  let term = query?.toLowerCase() ?? ''
  for (const tag of tags.slice(0, 20)) {
    const i = tag.tag.name.toLowerCase().indexOf(term)
    const name = tag.tag.name
    tag.markup = [
      ...(i > 0 ? [`<b>${name.slice(0, i)}</b>`] : []),
      `<span>${name.slice(i, i + term.length)}</span>`,
      ...(i + term.length < name.length
        ? [`<b>${name.slice(i + term.length)}</b>`]
        : []),
    ].join('')
  }
  return tags
}
