import {
  UniqueViolationError,
  DataError,
  ForeignKeyViolationError,
} from 'objection'
import { UserInputError } from 'apollo-server-lambda'
import { List, UserLists } from '../../models'
import resolver from '../resolver'
import wrap, { filterKeys } from '~/utils/object'
import type { ChangeListInput, CreateListInput } from '~/schema/gen/schema'

export const createList = resolver<List>().isAdmin<{ input: CreateListInput }>(
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
        wrap(input)
          .mapKeys(k => k.replace(/([A-Z])/g, (_, v) => '_' + v.toLowerCase()))
          .rename('listed', 'public')
          .mapValues((v: string, k: string) =>
            k.endsWith('Color') ? v.toLowerCase() : v
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
      .rename('listed', 'public')
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

export const setListPosition = resolver().isAdmin(
  async ({ args: { listId, pos }, query, knex }) => {
    let lists = (await query
      .raw(List)
      .where('sort_pos', '>=', pos)
      .orWhere({ id: listId })) as List[]
    const list = lists.find(({ id }) => id === listId)
    console.log({ lists, list })
    if (!list)
      throw new UserInputError(`list with id '${listId}' doesn't exist`)
    await Promise.all([
      query
        .raw(List)
        .patch({ sort_pos: knex.raw('sort_pos + 1') })
        .whereIn(
          'id',
          lists.flatMap(({ id }) => (id !== listId ? [id] : []))
        ),
      query
        .raw(List)
        .patch({ sort_pos: knex.raw(`sort_pos + ${pos - list.sort_pos}`) })
        .where({ id: listId }),
    ])
  }
)
