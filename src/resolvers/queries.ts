import {
  User,
  Tags,
  List,
  Tokens,
  Invite,
  Signup,
  ConnectGoogle,
} from '../models'
import { handleError, UserInputError } from '../error'
import { createClient } from '../google'
import knex from '../db'
import resolver from './resolver'
import { system } from '../authorization/user'
import { searchUsers, searchTags } from '../search'
import validate from '../utils/validity'
import { google } from 'googleapis'
import { requestScopes, userClient, scopes } from '../google'

export const me = resolver<User>().loggedIn(
  async ({ query, ctx: { id } }) => await query().findById(id)
)

export const mentors = resolver<User>()(
  async ({ query }) =>
    await query({ join: true, include: 'mentors' })
      .select(knex.raw('mentors.score + RANDOM() as rank'))
      .whereIn('role', ['mentor', 'admin'])
      .andWhere({ listed: true })
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
  async ({ args: { redirect }, ctx: { id }, query }) => {
    const googleConnect = await query
      .raw(ConnectGoogle)
      .where({ user_id: id })
      .first()
    if (!googleConnect)
      return requestScopes(redirect)([...scopes.SIGNIN, ...scopes.CALENDAR])
    if (googleConnect.calendar_id) return null
    const client = await userClient(googleConnect)
    const info = await client.userInfo()
    return requestScopes(redirect)('CALENDAR', { login_hint: info.email }, true)
  }
)

export const googleSigninUrl = resolver<
  string
>()(({ args: { redirect, state } }) =>
  requestScopes(redirect)('SIGNIN', state ? { state } : {}, true)
)

export const googleSignupUrl = resolver<
  string
>()(({ args: { redirect, state } }) =>
  requestScopes(redirect)('SIGNIN', { state })
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
      Object.keys((fields.users as Fields).user).some(
        k =>
          !['id', 'name', 'handle', 'profilePictures', '__typename'].includes(k)
      )
    ) {
      users = ((await query({
        section: 'users.user',
        entryName: 'Person',
      }).whereIn(
        'id',
        users.map(({ user }) => user.id)
      )) as User[]).map(user => ({
        user,
        markup: users.find(({ user: { id } }) => id === user.id).markup,
      }))
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
    const signup = await query
      .raw(Signup)
      .findById(token)
      .asUser(system)

    let name: string
    let picture
    if (signup?.google_id) {
      const creds = await query
        .raw(ConnectGoogle)
        .findById(signup.google_id)
        .asUser(system)
      const client = createClient()
      client.setCredentials(creds)
      const { data } = await google
        .oauth2({ auth: client, version: 'v2' })
        .userinfo.get()
      name = data.name
      if (!data.picture?.endsWith('photo.jpg')) picture = data.picture
    } else if (signup?.email) {
      name = signup.email
        .split('@')[0]
        .replace(/[^a-zA-Z]+/g, ' ')
        .toLowerCase()
        .trim()
        .replace(/(\s|^)[a-z]/g, v => v.toUpperCase())
    }

    return {
      id: token,
      email: invite.email,
      role: invite.role.toUpperCase(),
      authComplete: !!signup,
      name,
      ...(picture && {
        picture: {
          url: picture,
        },
      }),
      defaultPicture: {
        url: `https://${process.env.BUCKET_NAME}.s3.eu-west-2.amazonaws.com/default.png`,
      },
    }
  }
)

export const checkValidity = resolver<any>()(
  async ({ args }) => await validate.batch(args)
)
