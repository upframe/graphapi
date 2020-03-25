import { UniqueViolationError } from 'objection'
import { UserInputError } from 'apollo-server-lambda'
import { List } from '../../models'

export const createList: Resolver = async ({ args: { name }, query }) => {
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
