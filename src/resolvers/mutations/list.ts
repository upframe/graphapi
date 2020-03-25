import { UniqueViolationError } from 'objection'
import { UserInputError } from 'apollo-server-lambda'

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
