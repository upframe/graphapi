import {
  UniqueViolationError,
  DataError,
  ForeignKeyViolationError,
} from 'objection'
import { UserInputError } from 'apollo-server-lambda'
import { List, UserLists } from '../../models'
import resolver from '../resolver'

export const createList = resolver<List>().isAdmin(
  async ({ args: { name, description, photoUrl, publicView }, query }) => {
    try {
      const { id } = await query.raw().insert({
        name,
        description,
        picture_url: photoUrl,
        public_view: publicView,
      })
      return await query().findById(id)
    } catch (e) {
      if (e instanceof UniqueViolationError)
        throw new UserInputError(`list ${name} already exists`)
      throw e
    }
  }
)

export const deleteList = resolver().isAdmin(
  async ({ args: { listId }, query }) => {
    if (
      (await query
        .raw(List)
        .findById(listId)
        .delete()) === 0
    )
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
    if (
      (await query
        .raw(UserLists)
        .findById([userId, listId])
        .delete()) === 0
    )
      throw new UserInputError(`user ${userId} is not part of list ${listId}`)
    return await query().findById(listId)
  }
)

export const changeListInfo = resolver<UserLists>().isAdmin(
  async ({ args: { input }, query }) => {
    const update: any = {}
    if (input.description) update.description = input.description
    else if (input.remove?.includes('description')) update.description = null

    if (typeof input.publicView === 'boolean')
      update.public_view = input.publicView

    if (input.photoUrl) update.photo_url = input.photoUrl
    else if (input.remove?.includes('photoUrl')) update.photo_url = null

    return await query().patchAndFetchById(input.listId, update)
  }
)
