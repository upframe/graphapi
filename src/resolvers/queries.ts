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
import resolver from './resolver'
import { system } from '../authorization/user'
import { searchUsers, searchTags } from '../search'
import validate from '../utils/validity'
import {
  requestScopes,
  userClient,
  scopes,
  signUpInfo as googleInfo,
} from '../google'
import Conversation from '~/messaging/conversation'
import Channel from '~/messaging/channel'
import { ddb } from '../utils/aws'
import * as page from '~/utils/pagination'

export const me = resolver<User>().loggedIn(
  async ({ query, ctx: { id } }) => await query().findById(id)
)

export const mentors = resolver<User>()(
  async ({ query, knex }) =>
    await query({ join: true, include: 'mentors' })
      .select(knex.raw('LEAST(mentors.score, 1) as rank'))
      .whereIn('role', ['mentor', 'admin'])
      .andWhere({ 'mentors.listed': true })
      .orderBy('rank', 'DESC')
)

export const user = resolver<User>()(
  async ({ query, args: { id, handle } }) => {
    if (!id && !handle) throw new UserInputError('must provide handle or id')
    const user = await query()
      .where(
        ...((id ? ['users.id', '=', id] : ['handle', 'ilike', handle]) as [
          string,
          string,
          string
        ])
      )
      .first()
    if (!user) throw handleError(`can't find user ${handle ?? id}`)
    return user
  }
)

export const users = resolver<User[]>()(
  async ({ query, args: { ids = [], handles = [] } }) => {
    if (ids.length + handles.length === 0)
      throw new UserInputError('must provide at least one id or handle')
    return (await query()
      .whereIn('id', ids)
      .orWhereIn('handle', handles)) as User[]
  }
)

export const calendarConnectUrl = resolver<string>().loggedIn(
  async ({ args: { redirect }, ctx: { id }, query, knex }) => {
    const googleConnect = await query
      .raw(ConnectGoogle)
      .where({ user_id: id })
      .first()
    if (!googleConnect)
      return requestScopes(redirect)([...scopes.SIGNIN, ...scopes.CALENDAR])
    if (googleConnect.calendar_id) return null
    const client = await userClient(knex, googleConnect)
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
  const res = await query().where('name', 'ilike', name).first()
  return {
    ...res,
    users: res.users.filter(({ searchable }) => searchable),
  } as Tags
})

export const tags = resolver<Tags>()(async ({ query, args: { orderBy } }) => {
  let tags = await query({ ...(orderBy === 'users' && { include: 'users' }) })
  if (orderBy === 'alpha')
    tags = tags.sort((a, b) => a.name.localeCompare(b.name))
  else if (orderBy === 'users')
    tags = tags.sort((a, b) => (b.users?.length ?? 0) - (a.users?.length ?? 0))
  return tags
})

export const lists = resolver<List>()(
  async ({ query, args: { includeUnlisted } }) => {
    let q = query()
    if (!includeUnlisted) q = q.where({ public: true }).orderBy('sort_pos')
    return await q
  }
)

export const list = resolver<List>()(async ({ query, args: { name } }) => {
  const res = await query({ join: true, include: 'users.mentors' })
    .where('lists.name', 'ILIKE', name.toLowerCase())
    .first()
  if (res.users)
    res.users = res.users.sort(
      (a, b) =>
        Math.min(b.mentors?.score ?? 0, 1) +
        Math.random() -
        (Math.min(a.mentors?.score ?? 0, 1) + Math.random())
    )
  return res
})

export const isTokenValid = resolver<boolean>()(
  async ({ args: { token: tokenId }, ctx: { id }, query }) => {
    const token = await query.raw(Tokens).findById(tokenId).asUser(system)
    return id && id !== token.subject ? false : !!token
  }
)

export const search = resolver<any>()(
  async ({
    args: { term, maxUsers, maxTags, withTags = [], withTagNames = [] },
    query,
    knex,
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
      'users' in fields ? searchUsers(term, maxUsers, withTags, knex) : null,
      'tags' in fields ? searchTags(term, maxTags, withTags, knex) : null,
    ])

    if (
      users &&
      Object.keys((fields.users as Fields).user).some(
        k =>
          !['id', 'name', 'handle', 'profilePictures', '__typename'].includes(k)
      )
    ) {
      const ids = users.map(({ user }) => user.id)
      users = ((await query({
        section: 'users.user',
        entryName: 'Person',
      }).whereIn('id', ids)) as User[])
        .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
        .map(user => ({
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
    const signup = await query.raw(Signup).findById(token).asUser(system)

    let name: string
    let picture
    if (signup?.google_id) {
      const creds = await query
        .raw(ConnectGoogle)
        .findById(signup.google_id)
        .asUser(system)
      const data = await googleInfo(creds)
      if (data.name) name = data.name
      if (data.picture) picture = data.picture
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
        url: process.env.BUCKET_URL + 'default.png',
      },
    }
  }
)

export const checkValidity = resolver<any>()(
  async ({ args, knex }) => await validate.batch(args, knex)
)

export const conversation = resolver<any>().loggedIn(
  async ({ args: { conversationId }, ctx: { id } }) => {
    const con = await Conversation.get(conversationId)
    return con?.participants?.includes(id) ? con : null
  }
)

export const channel = resolver<any>().loggedIn(
  async ({ args: { channelId }, ctx: { id } }) => {
    const ch = await Channel.get(channelId)
    return ch?.participants?.includes(id) ? { ...ch, id: ch.channelId } : null
  }
)

export const redirects = resolver<any[]>().isAdmin(async () => {
  const { Items } = await ddb.scan({ TableName: 'redirects' }).promise()
  return Items.map(({ path, ...rest }) => ({ from: path, ...rest }))
})

export const userList = resolver<Connection<User>>().isAdmin(
  async ({ query, knex, args: { sortByField, order, ...pagination } }) => {
    const sortFields = ['id', 'name']
    if (!sortFields.includes(sortByField))
      throw new UserInputError(
        `can't sort by '${sortByField}', valid fields are ${sortFields
          .map(v => `'${v}'`)
          .join(', ')}`
      )
    page.validate(pagination)
    const { limit = 50, cursor, direction } = page.flatten(pagination)
    let q = query
      .raw(User)
      .orderBy(
        sortByField,
        direction === 'forward' ? order : order === 'ASC' ? 'DESC' : 'ASC'
      )
      .limit(limit)
    if (cursor) {
      q = q.where(
        sortByField,
        direction === 'forward' ? '>' : '<',
        knex('users').select(sortByField).where({ id: cursor })
      )
    }
    const users = await q
    if (direction === 'backward') users.reverse()
    return {
      edges: users.map(node => ({ node, cursor: node.id })),
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }
  }
)
