import {
  UniqueViolationError,
  DataError,
  ForeignKeyViolationError,
} from 'objection'
import { UserInputError } from 'apollo-server-lambda'
import { List, UserLists } from '../../models'
import resolver from '../resolver'
import wrap, { filterKeys, mapKeys, mapValues } from '~/utils/object'
import type { ChangeListInput } from '~/schema/gen/schema'

export const createList = resolver<List>().isAdmin(
  async ({ args: { input }, query }) => {
    const invalidColor = Object.values(filterKeys(input, /Color$/)).find(
      (v: string) =>
        !/^#[0-9a-f]+$/i.test(v) || ![3, 4, 6, 8].includes(v.length - 1)
    )
    if (invalidColor)
      throw new UserInputError(
        `invalid color '${invalidColor}', Color must be in hex notation`
      )
    try {
      const { id } = await query.raw().insert(
        mapValues(
          mapKeys(input, k =>
            k.replace(/([A-Z])/g, (_, v) => '_' + v.toLowerCase())
          ),
          (v: string, k: string) => (k.endsWith('Color') ? v.toLowerCase() : v)
        )
      )
      return await query().findById(id)
    } catch (e) {
      if (e instanceof UniqueViolationError)
        throw new UserInputError(`list '${input.name}' already exists`)
      throw e
    }
  }
)

export const deleteList = resolver().isAdmin(
  async ({ args: { listId }, query }) => {
    if ((await query.raw(List).findById(listId).delete()) === 0)
      throw new UserInputError(`list with id ${listId} doesn't exist`)
  }
)

export const addToList = resolver<List>().isAdmin(
  async ({ args: { listId, userId }, query }) => {
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
)

export const removeFromList = resolver<UserLists>().isAdmin(
  async ({ args: { listId, userId }, query }) => {
    if ((await query.raw(UserLists).findById([userId, listId]).delete()) === 0)
      throw new UserInputError(`user ${userId} is not part of list ${listId}`)
    return await query().findById(listId)
  }
)

export const changeListInfo = resolver<UserLists>().isAdmin<{
  input: ChangeListInput
}>(async ({ args: { input }, query }) => {
  return await query().patchAndFetchById(input.id, {
    ...wrap(input)
      .mapKeys(k => k.replace(/([A-Z])/g, (_, v) => '_' + v.toLowerCase()))
      .filterKeys(/^(?!(id|remove)$)/)
      .update('illustration', (v: string) =>
        v.replace(/^https?:\/\//, '').replace(process.env.ASSET_BUCKET, '')
      ),
    ...Object.fromEntries(
      (input.remove || []).map(k => [
        k.replace(/([A-Z])/g, (_, v) => '_' + v.toLowerCase()),
        null,
      ])
    ),
  })
})
