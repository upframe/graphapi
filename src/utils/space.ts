import type AuthUser from '~/authorization/user'
import type Knex from 'knex'
import { ForbiddenError } from '~/error'

export const checkSpaceAdmin = async (
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
