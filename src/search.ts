import knex from './db'
import levenshtein from 'fast-levenshtein'
import _ from 'lodash'
import { filterKeys } from './utils/object'

const markup = (value: string, term: string) => {
  if (!term) return `<span>${value}</span>`
  const i = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .indexOf(term.toLowerCase())
  if (i < 0) return `<span>${value}</span>`
  return [
    ...(i > 0 ? [`<b>${value.slice(0, i)}</b>`] : []),
    `<span>${value.slice(i, i + term.length)}</span>`,
    ...(i + term.length < value.length
      ? [`<b>${value.slice(i + term.length)}</b>`]
      : []),
  ].join('')
}

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
      'type',
      'searchable'
    )
    .leftJoin('mentors', { 'users.id': 'mentors.id' })
    .leftJoin('profile_pictures', { 'users.id': 'profile_pictures.user_id' })
    .whereNot('role', 'nologin')
    .andWhere('size', '<=', 128)
    .andWhere('searchable', true)

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

  return users
    .slice(0, limit)
    .map(user => ({ user, markup: markup(user.name, term) }))
}

const tagSelect = () => knex('tags').select('name', 'id')

const tagSearchQuick = async (term: string, limit: number, exclude = []) => {
  return await (term
    ? tagSelect().where('name', 'ilike', `${term}%`)
    : tagSelect()
  )
    .whereNotIn('name', exclude)
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

export const searchTags = async (
  query: string,
  limit: number,
  withTags = []
) => {
  let tags = []
  if (query?.length ?? 0 <= 2)
    tags = await tagSearchQuick(query, limit, withTags)
  const quickNum = tags.length
  if (limit - tags.length > 0) {
    tags.push(
      ...(await tagSearchComplex(query, limit - tags.length, [
        ...tags.map(({ name }) => name),
        ...withTags,
      ]))
    )
    tags = tags
      .map((tag, i) => ({
        ...tag,
        dist: levenshtein.get(query, tag.name) - i < quickNum ? 1000 : 0,
      }))
      .sort((a, b) => a.dist - b.dist)
  }
  tags = tags.map(tag => ({ tag }))
  for (const tag of tags.slice(0, 20))
    tag.markup = markup(tag.tag.name, query?.toLowerCase() ?? '')
  return tags
}
