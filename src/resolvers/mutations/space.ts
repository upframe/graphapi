import resolver from '../resolver'
import uuid from 'uuid/v4'
import type { Space } from '~/models'
import { UniqueViolationError } from 'objection'
import { ForbiddenError, UserInputError } from '~/error'
import wrap from '~/utils/object'

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

export const addToSpace = resolver<Space>()(
  async ({
    query,
    args: { spaceId, userIds, mentor, owner },
    ctx: { id, user },
    knex,
  }) => {
    if (
      !user.groups.includes('admin') &&
      !(
        id &&
        (await knex('user_spaces')
          .where({ user_id: id, space_id: spaceId })
          .first())
      )
    )
      throw new ForbiddenError(
        'you are not allowed to add members to this space'
      )

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
}>(async ({ args, ctx, query, knex }) => {
  let input = wrap(args.input)

  if (
    !ctx.user.groups.includes('admin') &&
    !(
      ctx.id &&
      (await knex('user_spaces')
        .where({ user_id: ctx.id, space_id: input.id })
        .first())
    )
  )
    throw new ForbiddenError('you are not allowed to modify this space')

  input = input.mapValues((v: string) => v.trim())
  input
    .filterKeys(['name', 'handle'])
    .filterValues((v: string) => v.length < 2)
    .mapKeys(k => {
      throw new UserInputError(
        `space ${k} must have a minimum length of 2 characters`
      )
    })
  if ('handle' in input && !/^[a-z0-9_-.]+$/i.test(input.handle))
    throw new UserInputError("handle can't include special characters")

  const { id, ...fields } = input.mapValues((v: string) => v || null)

  return await query().patchAndFetchById(id, fields)
})
