import {
  UniqueViolationError,
  DataError,
  ForeignKeyViolationError,
} from 'objection'
import { UserInputError } from 'apollo-server-lambda'
import { List, UserLists } from '../../models'

export const createList: Resolver<List> = async ({ args: { name }, query }) => {
  try {
    const { id } = await query.raw().insert({ name })
    return await query().findById(id)
  } catch (e) {
    if (e instanceof UniqueViolationError)
      throw new UserInputError(`list ${name} already exists`)
    throw e
  }
}

export const deleteList: Resolver = async ({ args: { listId }, query }) => {
  if (
    (await query
      .raw(List)
      .findById(listId)
      .delete()) === 0
  )
    throw new UserInputError(`list with id ${listId} doesn't exist`)
}

export const addToList: Resolver<List> = async ({
  args: { listId, userId },
  query,
}) => {
  try {
    await query.raw(UserLists).insert({ user_id: userId, list_id: listId })
    return await query().findById(listId)
  } catch (e) {
    if (e instanceof UniqueViolationError)
      throw new UserInputError(`user ${userId} is already part of ${listId}`)
    if (e instanceof DataError) throw new UserInputError('invalid id')
    if (e instanceof ForeignKeyViolationError)
      throw new UserInputError(
        `invalid ${e.constraint.includes('list_id') ? 'list' : 'user'} id`
      )
    throw e
  }
}

export const removeFromList: Resolver<UserLists> = async ({
  args: { listId, userId },
  query,
}) => {
  if (
    (await query
      .raw(UserLists)
      .findById([userId, listId])
      .delete()) === 0
  )
    throw new UserInputError(`user ${userId} is not part of list ${listId}`)
  return await query().findById(listId)
}
