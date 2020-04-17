import { User, Tags, List, Tokens, Invite } from '../models'
import { handleError, UserInputError } from '../error'
import { generateAuthUrl } from '../gcal'
import { generateAuthUrl as signinUrl, signInScopes } from '../google'
import knex from '../db'
import resolver from './resolver'
import { system } from '../authorization/user'
import { searchUsers, searchTags } from '../search'

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

export const googleSigninUrl = resolver<string>()(
  async ({ args: { state } }) => await signinUrl(signInScopes, state)
)

export const tag = resolver<Tags>()(async ({ query, args: { id, name } }) => {
  if (!!id === !!name)
    throw new UserInputError('must provide either id or name')
  if (id) return await query().findById(id)
  return await query()
    .where('name', 'ilike', name)
    .first()
})

export const tags = resolver<Tags>()(async ({ query, args: { orderBy } }) => {
  let tags = await query({ ...(orderBy === 'users' && { include: 'users' }) })
  if (orderBy === 'alpha')
    tags = tags.sort((a, b) => a.name.localeCompare(b.name))
  else if (orderBy === 'users')
    tags = tags.sort((a, b) => (b.users?.length ?? 0) - (a.users?.length ?? 0))
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

export const search = resolver<any>()(
  async ({
    args: { term, maxUsers, maxTags, withTags = [], withTagNames = [] },
    query,
    fields,
  }) => {
    if (withTagNames?.length)
      withTags = [
        ...withTags,
        ...(
          await query
            .raw(Tags)
            .select('id')
            .whereRaw(
              `name ILIKE ANY (ARRAY[${withTagNames
                .map(v => `'${v}'`)
                .join(',')}])`
            )
        ).map(({ id }) => id),
      ]

    let [users, tags] = await Promise.all([
      'users' in fields ? searchUsers(term, maxUsers, withTags) : null,
      'tags' in fields ? searchTags(term, maxTags) : null,
    ])

    if (
      users &&
      Object.keys(fields.users).some(
        k =>
          !['id', 'name', 'handle', 'profilePictures', '__typename'].includes(k)
      )
    ) {
      users = await query({ section: 'users', entryName: 'Person' }).whereIn(
        'id',
        users.map(({ id }) => id)
      )
    }
    return { users, tags }
  }
)

export const signUpInfo = resolver<any>()(
  async ({ args: { token }, query }) => {
    if (!token) throw new UserInputError('must provide token')
    const invite = await query.raw(Invite).findById(token)
    if (!invite) throw new UserInputError('invalid invite token')
    if (invite.redeemed) throw new UserInputError('invite token already used')
    return { email: invite.email, role: invite.role.toUpperCase() }
  }
)
