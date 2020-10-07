import resolver from '../resolver'
import uuid from 'uuid/v4'
import type { Space } from '~/models'
import { UniqueViolationError } from 'objection'
import { UserInputError } from '~/error'

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
