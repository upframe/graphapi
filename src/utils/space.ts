import type AuthUser from '~/authorization/user'
import type Knex from 'knex'
import { ForbiddenError } from '~/error'

export const checkSpaceAdmin = async <T extends string | false = string>(
  spaceId: string,
  user: AuthUser,
  knex: Knex,
  throwMsg: T = 'modify' as T
): Promise<T extends string ? void : boolean> => {
  if (
    !user?.id ||
    (!user.groups.includes('admin') &&
      !(
        await knex('user_spaces')
          .where({ user_id: user.id, space_id: spaceId })
          .first()
      ).is_owner)
  ) {
    if (throwMsg)
      throw new ForbiddenError(`you are not allowed to ${throwMsg} this space`)
    else return false as any
  }
  if (!throwMsg) return true as any
}
