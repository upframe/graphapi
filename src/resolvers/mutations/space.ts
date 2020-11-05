import resolver from '../resolver'
import uuid from 'uuid/v4'
import type { Space } from '~/models'
import { UniqueViolationError } from 'objection'
import { UserInputError } from '~/error'
import wrap from '~/utils/object'
import genToken from '~/utils/token'
import { checkSpaceAdmin } from '~/utils/space'
import { sns } from '~/utils/aws'
import axios from 'axios'
import audit from '~/utils/audit'
import * as M from '~/models'
import * as email from '~/email'
import { system } from '~/authorization/user'

export const createSpace = resolver<Space>().isAdmin(
  async ({ query, args: { name, handle = name }, ctx: { id } }) => {
    try {
      const space = await query().insertAndFetch({ id: uuid(), name, handle })
      await Promise.all([
        audit.space(space.id, 'create_space', { editor: id }),
        audit('admin_edits', {
          eventType: 'create_space',
          editor: id,
          space: space.id,
        }),
      ])
      return space
    } catch (e) {
      if (e instanceof UniqueViolationError)
        throw new UserInputError(`handle '${handle}' already in use`)
      throw e
    }
  }
)

export const addToSpace = resolver<Space>().isAdmin(
  async ({
    query,
    args: { spaceId, userIds, mentor, owner },
    ctx: { id },
    knex,
  }) => {
    if (!userIds?.length)
      throw new UserInputError('must provide at least one user')

    const { rows } = await knex
      .raw(
        `${knex('user_spaces')
          .insert(
            userIds.map(user_id => ({
              user_id,
              space_id: spaceId,
              is_mentor: mentor,
              is_owner: owner,
            }))
          )
          .toString()} ON CONFLICT DO NOTHING RETURNING *`
      )
      .catch(() => {
        throw new UserInputError('unknown space or user')
      })

    const failed = userIds.filter(
      id => !rows.find(({ user_id }) => user_id === id)
    )

    await Promise.all(
      userIds
        .filter(id => !failed.includes(id))
        .map(user =>
          audit.space(spaceId, 'add_user', { editor: id, user, mentor, owner })
        )
    )

    if (failed.length)
      throw new UserInputError(`couldn't add users ${failed.join(', ')}`)

    return await query().findById(spaceId)
  }
)

type InfoInput = {
  id: string
  name?: string
  handle?: string
  description?: string
  sidebar?: string
}

export const changeSpaceInfo = resolver<Space>()<{
  input: InfoInput
}>(async ({ args, ctx: { user }, query, knex }) => {
  let input = wrap(args.input)

  await checkSpaceAdmin(input.id, user, knex)

  input = input.mapValues((v: string) => v.trim())
  input
    .filterKeys(['name', 'handle'])
    .filterValues((v: string) => v.length < 2)
    .mapKeys(k => {
      throw new UserInputError(
        `space ${k} must have a minimum length of 2 characters`
      )
    })
  if ('handle' in input && !/^[a-z0-9_\-.]+$/i.test(input.handle))
    throw new UserInputError("handle can't include special characters")

  const { id, ...fields } = input.mapValues((v: string) => v || null)

  const space = await query().findById(id).asUser(system)
  await Promise.all(
    Object.entries(args.input)
      .filter(([k]) => k !== 'id')
      .map(([k, v]) =>
        audit.space(id, 'change_space_info', {
          editor: user.id,
          field: k,
          new: v as string,
          old: space[k],
        })
      )
  )

  try {
    const space = await query().patchAndFetchById(id, fields).asUser(system)
    delete space.members
    delete space.mentors
    delete space.owners
    return space
  } catch (e) {
    if (e instanceof UniqueViolationError)
      throw new UserInputError('handle already taken')
    throw e
  }
})

export const createSpaceInvite = resolver<string>()<{
  space: string
  role: 'FOUNDER' | 'MENTOR' | 'OWNER'
}>(async ({ knex, query, args: { space: spaceId, role }, ctx: { user } }) => {
  await checkSpaceAdmin(spaceId, user, knex, 'create invites links for')

  const space = await query.raw(M.Space).findById(spaceId)

  const inviteColumn = `${role.toLowerCase()}_invite`
  const existing = space[inviteColumn]
  if (existing) await knex('invites').where({ id: existing }).delete()

  const invite = await query
    .raw(M.Invite)
    .insertAndFetch({
      id: genToken(),
      issuer: user.id,
      role: role === 'FOUNDER' ? 'user' : 'mentor',
    })
    .asUser(system)

  await knex('space_invites').insert({
    id: invite.id,
    owner: role === 'OWNER',
    mentor: role !== 'FOUNDER',
    space: spaceId,
  })

  await query
    .raw(M.Space)
    .update({ [inviteColumn]: invite.id })
    .findById(spaceId)
    .asUser(system)

  return invite.id
})

export const revokeSpaceInvite = resolver()<{
  space: string
  role: 'FOUNDER' | 'MENTOR' | 'OWNER'
}>(async ({ args: { space: spaceId, role }, ctx: { user }, knex, query }) => {
  await checkSpaceAdmin(spaceId, user, knex, 'remove invites links for')

  const space = await query.raw(M.Space).findById(spaceId)
  const inviteColumn = `${role.toLowerCase()}_invite`
  if (!space[inviteColumn]) return

  await query.raw(M.Invite).asUser(system).deleteById(space[inviteColumn])
})

export const joinSpace = resolver<Space>().loggedIn<{ token: string }>(
  async ({ args: { token }, knex, ctx: { id: user_id } }) => {
    const invite = await knex('space_invites').where({ id: token }).first()
    if (!invite) throw new UserInputError('invalid token')

    await knex('user_spaces').insert({
      space_id: invite.space,
      user_id,
      is_mentor: invite.mentor,
      is_owner: invite.owner,
    })

    await audit.space(invite.space, 'join_space', {
      editor: user_id,
      ...invite,
    })

    return await knex('spaces').where({ id: invite.space }).first()
  }
)

export const processSpaceImage = resolver()<{ signedUrl: string; crop: any }>(
  async ({ args: { signedUrl, crop }, ctx: { user }, knex }) => {
    const [spaceId, file] = signedUrl
      .split('?')[0]
      .split('spaces/')[1]
      .split('/')
    const type = file.split('-')[0]
    const space = await knex('spaces').where({ id: spaceId }).first()

    if (!['space', 'cover'].includes(type) || !space)
      throw new UserInputError('invalid url')
    await checkSpaceAdmin(spaceId, user, knex)

    const imgTask = {
      input: signedUrl.split('?')[0],
      outputs: [
        {
          bucket: 'upframe-user-media',
          key: `spaces/${spaceId}/${
            file.split('-raw')[0]
          }-\${width}x\${height}.\${format}`,
        },
      ],
      crop,
      resize:
        type === 'cover'
          ? [{ width: 880 }, { width: 1760 }]
          : [{ width: 112 }, { width: 224 }, { width: 336 }],
      formats: ['jpeg', 'webp'],
    }

    if (process.env.IS_OFFLINE)
      await axios.post(`${process.env.IMG_ENDPOINT}/process`, [imgTask], {
        headers: { auth: process.env.IMG_SECRET },
      })
    else
      await sns
        .publish({
          TopicArn: process.env.IMG_SNS,
          Message: JSON.stringify(imgTask),
        })
        .promise()

    await audit.space(spaceId, `upload_${type}_photo` as any, {
      editor: user.id,
    })
  }
)

export const removeFromSpace = resolver()<{ space: string; user: string }>(
  async ({ args, ctx: { user }, knex }) => {
    if (args.user !== user.id)
      await checkSpaceAdmin(args.space, user, knex, 'remove members from')

    await knex('user_spaces')
      .where({ space_id: args.space, user_id: args.user })
      .delete()

    await audit.space(args.space, 'remove_member', {
      editor: user.id,
      user: args.user,
    })
  }
)

export const changeMemberRole = resolver()<{
  space: string
  user: string
  mentor: boolean
  owner: boolean
}>(async ({ args: { space, user: userId, ...role }, ctx, query, knex }) => {
  await checkSpaceAdmin(space, ctx.user, knex, 'change user roles in')

  const user = await knex('user_spaces')
    .where({ space_id: space, user_id: userId })
    .first()

  if (!user) throw new UserInputError('user not member of space')
  if ('mentor' in role && role.mentor === user.is_mentor)
    throw new UserInputError(
      `user already is${role.mentor ? '' : "n't"} a mentor`
    )
  if ('owner' in role && role.owner === user.is_owner)
    throw new UserInputError(
      `user already is${role.owner ? '' : "n't"} an owner`
    )

  if (role.mentor && !(await query.raw(M.Mentor).findById(userId).first()))
    await Promise.all([
      query.raw(M.Mentor).insert({ id: userId, listed: false }),
      query.raw(M.User).patch({ role: 'mentor' }).findById(userId),
    ])

  await knex('user_spaces')
    .update({ is_mentor: role.mentor, is_owner: role.owner })
    .where({ space_id: space, user_id: userId })

  await Promise.all(
    Object.keys(role).map(k =>
      audit.space(space, 'change_member_role', {
        editor: ctx.id,
        user: userId,
        [k]: role[k],
      })
    )
  )
})

export const inviteToSpace = resolver()<{
  space: string
  emails: string[]
  role: 'FOUNDER' | 'MENTOR' | 'OWNER'
}>(async ({ args: { space, emails, role }, ctx: { user }, knex, query }) => {
  await checkSpaceAdmin(space, user, knex, 'issue invitations for')
  if (!emails.length) return

  emails = Array.from(new Set(emails.map(v => v.toLowerCase())))

  // check for duplicate invites
  const duplicate = await knex('space_invites')
    .leftJoin('invites', { 'invites.id': 'space_invites.id' })
    .where({ space })
    .whereIn('invites.email', emails)
    .select('email')

  if (duplicate.length)
    throw new UserInputError(
      `${duplicate.map(({ email }) => email).join(', ')} are already invited`
    )

  // check for already members
  const members = await knex('user_spaces')
    .leftJoin('users', { 'users.id': 'user_spaces.user_id' })
    .where({ space_id: space })
    .whereIn('email', emails)

  if (members.length)
    throw new UserInputError(
      `${members.map(({ email }) => email).join(', ')} are already members`
    )

  // create upframe invites
  const upframeInvites = await query.raw(M.Invite).insertAndFetch(
    emails.map(email => ({
      id: genToken(),
      email,
      issuer: user.id,
      role: role === 'FOUNDER' ? 'user' : 'mentor',
    }))
  )

  // create space invites
  const invites = await knex('space_invites')
    .insert(
      upframeInvites.map(({ id }) => ({
        id,
        space,
        owner: role === 'OWNER',
        mentor: role !== 'FOUNDER',
      }))
    )
    .returning('*')

  // send invite emails & audit log event
  await Promise.all(
    invites.flatMap(invite => [
      email.send({ template: 'SPACE_INVITE', ctx: { invite: invite.id } }),
      audit.space(space, 'invite_to_space', {
        editor: user.id,
        ...upframeInvites.find(({ id }) => id === invite.id),
        ...invite,
      }),
    ])
  )
})
