import resolver from '../resolver'
import uuid from 'uuid/v4'
import type { Space } from '~/models'
import { UniqueViolationError } from 'objection'
import { ForbiddenError, UserInputError } from '~/error'
import wrap from '~/utils/object'
import genToken from '~/utils/token'
import type AuthUser from '~/authorization/user'
import type Knex from 'knex'

export const createSpace = resolver<Space>().isAdmin(
  async ({ query, args: { name, handle = name } }) => {
    try {
      return await query().insertAndFetch({ id: uuid(), name, handle })
    } catch (e) {
      if (e instanceof UniqueViolationError)
        throw new UserInputError(`handle '${handle}' already in use`)
      throw e
    }
  }
)

const checkSpaceAdmin = async (
  spaceId: string,
  user: AuthUser,
  knex: Knex,
  action = 'modify'
) => {
  if (
    !user?.id ||
    (!user.groups.includes('admin') &&
      !(
        await knex('user_spaces')
          .where({ user_id: user.id, space_id: spaceId })
          .first()
      ).is_owner)
  )
    throw new ForbiddenError(`you are not allowed to ${action} this space`)
}

export const addToSpace = resolver<Space>()(
  async ({
    query,
    args: { spaceId, userIds, mentor, owner },
    ctx: { user },
    knex,
  }) => {
    await checkSpaceAdmin(spaceId, user, knex, 'add users to')

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

  return await query().patchAndFetchById(id, fields)
})

export const createSpaceInvite = resolver<string>()<{
  space: string
  role: 'FOUNDER' | 'MENTOR' | 'OWNER'
}>(async ({ knex, args: { space, role }, ctx: { user } }) => {
  await checkSpaceAdmin(space, user, knex, 'create invites links for')

  const invite = {
    id: `s-${genToken()}`,
    space,
    mentor: role !== 'FOUNDER',
    owner: role === 'OWNER',
  }

  await Promise.all([
    knex('space_invites').insert(invite),
    knex('spaces')
      .update({ [`${role.toLowerCase()}_invite`]: invite.id })
      .where({ id: space }),
  ])

  return invite.id
})

export const revokeSpaceInvite = resolver()<{
  space: string
  role: 'FOUNDER' | 'MENTOR' | 'OWNER'
}>(async ({ args: { space: spaceId, role }, ctx: { user }, knex }) => {
  await checkSpaceAdmin(spaceId, user, knex, 'remove invites links for')

  const space = await knex('spaces').where({ id: spaceId }).first()

  const field = `${role.toLowerCase()}_invite`
  const link = space[field]

  if (!link) return
  await knex('spaces')
    .update({ [field]: null })
    .where({ id: spaceId })
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

    return await knex('spaces').where({ id: invite.space }).first()
  }
)
