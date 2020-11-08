import * as M from '~/models'
import { ForbiddenError, handleError, UserInputError } from '~/error'
import resolver from '../resolver'
import { system } from '~/authorization/user'
import { searchUsers, searchTags } from '~/search'
import validate from '~/utils/validity'
import Conversation from '~/messaging/conversation'
import Channel from '~/messaging/channel'
import { ddb } from '~/utils/aws'
import * as filterExpr from '~/utils/filter'
import { checkSpaceAdmin } from '~/utils/space'
import { isUUID } from '~/utils/validity'

export * from './space'
export * from './google'

export const me = resolver<M.User>().loggedIn(
  async ({ query, ctx: { id } }) => await query().findById(id)
)

export const mentors = resolver<M.User>()(
  async ({ query, knex }) =>
    await query({ join: true, include: 'mentors' })
      .select(knex.raw('LEAST(mentors.score, 1) as rank'))
      .whereIn('role', ['mentor', 'admin'])
      .andWhere({ 'mentors.listed': true })
      .orderBy('rank', 'DESC')
)

export const user = resolver<M.User>()(
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

export const users = resolver<M.User[]>()(
  async ({ query, args: { ids = [], handles = [] } }) => {
    if (ids.length + handles.length === 0)
      throw new UserInputError('must provide at least one id or handle')
    return (await query()
      .whereIn('id', ids)
      .orWhereIn('handle', handles)) as M.User[]
  }
)

export const tag = resolver<M.Tags>()(async ({ query, args: { id, name } }) => {
  if (!!id === !!name)
    throw new UserInputError('must provide either id or name')
  if (id) return await query().findById(id)
  const res = await query().where('name', 'ilike', name).first()
  return {
    ...res,
    users: res.users.filter(({ searchable }) => searchable),
  } as M.Tags
})

export const tags = resolver<M.Tags>()(
  async ({ query, args: { ids, orderBy } }) => {
    let q = query({ ...(orderBy === 'users' && { include: 'users' }) })
    if (Array.isArray(ids)) q = q.whereIn('tags.id', ids)
    let tags = await q
    if (orderBy === 'alpha')
      tags = tags.sort((a, b) => a.name.localeCompare(b.name))
    else if (orderBy === 'users')
      tags = tags.sort(
        (a, b) => (b.users?.length ?? 0) - (a.users?.length ?? 0)
      )
    return tags
  }
)

export const lists = resolver<M.List>()(
  async ({ query, args: { includeUnlisted } }) => {
    let q = query()
    if (!includeUnlisted) q = q.where({ public: true }).orderBy('sort_pos')
    return await q
  }
)

export const list = resolver<M.List>()(async ({ query, args: { name } }) => {
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
    const token = await query.raw(M.Tokens).findById(tokenId).asUser(system)
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
            .raw(M.Tags)
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
      }).whereIn('id', ids)) as M.User[])
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
    const signup: M.Signup = isUUID(token)
      ? await query.raw(M.Signup).findById(token).asUser(system)
      : undefined
    const invite = await query.raw(M.Invite).findById(signup?.token ?? token)
    if (!invite) throw new UserInputError('invalid invite token')
    if (invite.redeemed) throw new UserInputError('invite token already used')

    let name: string
    let picture
    // if (signup?.google_id) {
    //   const creds = await query
    //     .raw(M.ConnectGoogle)
    //     .findById(signup.google_id)
    //     .asUser(system)
    //   const data = await googleInfo(creds)
    //   if (data.name) name = data.name
    //   if (data.picture) picture = data.picture
    // } else if (signup?.email) {
    name = signup.email
      .split('@')[0]
      .replace(/[^a-zA-Z]+/g, ' ')
      .toLowerCase()
      .trim()
      .replace(/(\s|^)[a-z]/g, v => v.toUpperCase())
    // }

    return {
      id: signup?.id,
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

export const userList = resolver<any>().isAdmin(
  async ({
    args: { sortBy, order, limit, offset, search, filter },
    query,
    knex,
    fields,
  }) => {
    let filters: filterExpr.FilterExpression[] = []
    if (filter)
      filters = filterExpr.parse(filter, {
        allowedFields: [
          'email',
          'headline',
          'invitedBy.handle',
          'invitedBy.id',
          'invitedBy.name',
          'lists.id',
          'lists.name',
          'location',
          'name',
          'role',
          'tags.id',
          'tags.name',
        ],
      })

    const filtersBy = (prefix: string) =>
      filters.find(({ field }) => field.split('.')[0] === prefix)

    let users: M.User[]
    let total: number = undefined
    let ids: string[]

    let q: ReturnType<typeof query>
    let totalQuery: typeof q = query.raw(M.User)

    const queryOpts = {
      entryName: 'Person',
      section: 'edges.node',
      join: true,
      include: {
        ...(filtersBy('invitedBy') && { invitedBy: true }),
        ...(filtersBy('lists') && { lists: true }),
        ...(filtersBy('tags') && { tags: true }),
      },
    }

    if (!search)
      q = query(queryOpts).orderBy(sortBy, order).limit(limit).offset(offset)
    else {
      ids = (await searchUsers(search, Infinity, [], knex)).map(
        ({ user }) => user.id
      )
      total = ids.length
      if (offset >= ids.length) users = []
      else
        q = query({ entryName: 'Person', section: 'edges.node' }).whereIn(
          'id',
          ids.slice(offset, offset + limit)
        )
    }

    if (!users) {
      if (filters.length) {
        for (const filter of filters) {
          if (!filter.field.includes('.'))
            filter.field = `users.${filter.field}`
          if (filter.field === 'users.role')
            filter.value = filter.value.toLowerCase()
        }

        totalQuery = filterExpr.buildQuery(query(queryOpts), filters)
        q = filterExpr.buildQuery(q, filters)

        // @ts-ignore
        const node = fields.edges?.node ?? {}

        totalQuery = totalQuery.groupBy(
          ...[
            'users.id',
            (node.invitedBy || filtersBy('invitedBy')) && 'invitedBy.id',
            (node.lists || filtersBy('lists')) && 'lists.id',
            (node.tags || filtersBy('tags')) && 'tags.id',
          ].filter(Boolean)
        )
      }

      users = (await q) as M.User[]
      if (search) users.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
    }

    return {
      edges: users.map(node => ({ node, cursor: node.id })),
      totalQuery,
      total,
    }
  }
)

type Case = [
  match: string | RegExp,
  test: boolean | (() => boolean | Promise<boolean>)
]

export const audit = resolver<any>()<{ trail: string }>(
  async ({ args: { trail }, ctx: { user }, query, knex, fields }) => {
    const access = async (tests: Case[]) => {
      for (const [match, test] of tests)
        if (typeof match === 'string' ? match !== trail : !match.test(trail))
          continue
        else if (typeof test === 'boolean' ? test : await test()) return
      throw new ForbiddenError('your are not allowed to query this trail')
    }

    await access([
      ['admin_edits', user.groups.includes('admin')],
      [
        /^SPACE\|/,
        () => checkSpaceAdmin(trail.split('|').pop(), user, knex, false),
      ],
    ])

    const { Items } = await ddb
      .query({
        TableName: 'audit_trail',
        KeyConditionExpression: 'trail_id = :trail',
        ExpressionAttributeValues: { ':trail': trail },
      })
      .promise()

    const _objects: any[] = []

    if ('objects' in fields)
      _objects.push(
        ...(
          await Promise.all([
            query({ entryName: 'Person', section: 'objects' }).whereIn(
              'id',
              Items.flatMap(({ user, editor }) => [user, editor]).filter(
                Boolean
              )
            ),
            query({ entryName: 'Space', section: 'objects' }).whereIn(
              'id',
              Items.map(({ space }) => space).filter(Boolean)
            ),
            query({ entryName: 'List', section: 'objects' }).whereIn(
              'id',
              Items.map(({ list }) => list).filter(Boolean)
            ),
            query({ entryName: 'Tag', section: 'objects' }).whereIn(
              'id',
              Items.map(({ tag }) => tag).filter(Boolean)
            ),
          ])
        ).flat()
      )

    return Items.map(({ trail_id, event_id, time, ...rest }) => ({
      trailId: trail_id,
      id: event_id,
      date: new Date(time),
      payload: JSON.stringify(rest),
      _editorId: rest.editor,
      _objects,
    }))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map(({ date, ...v }) => ({ date: date.toISOString(), ...v }))
  }
)
