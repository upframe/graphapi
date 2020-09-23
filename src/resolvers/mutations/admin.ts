import resolver from '../resolver'
import token from '~/utils/token'
import { ddb } from '~/utils/aws'
import { User } from '~/models'
import { UniqueViolationError, ForeignKeyViolationError } from 'objection'
import { UserInputError } from 'apollo-server-lambda'
import { List, UserLists } from '../../models'
import wrap, { filterKeys } from '~/utils/object'
import type { ChangeListInput, CreateListInput } from '~/schema/gen/schema'
import * as cache from '~/utils/cache'

async function logEvent(trailId: string, event: any) {
  event.time = Date.now()
  event.trail_id = trailId
  event.event_id = `${(event.time / 1000) | 0}_${token()}`

  await ddb.put({ TableName: 'audit_trail', Item: event }).promise()
}

export const editUserInfo = resolver().isAdmin(
  async ({ args: { userId, info }, query, ctx: { id: editor } }) => {
    const user = await query.raw(User).findById(userId)

    await Promise.all(
      Object.entries(info).map(([field, v]) =>
        logEvent('admin_edits', {
          editor,
          eventType: 'edit_user_info',
          field,
          old: user[field],
          new: v,
          user: userId,
        })
      )
    )

    await query.raw(User).upsertGraph({ id: userId, ...info })
  }
)

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
  async ({ args: { listId, userIds }, query, ctx: { id: editor } }) => {
    const failed: string[] = []

    await Promise.all(
      userIds.map((user_id: string) =>
        query
          .raw(UserLists)
          .insert({ user_id, list_id: listId })
          .then(() =>
            logEvent('admin_edits', {
              editor,
              eventType: 'add_to_list',
              list: listId,
              user: user_id,
            })
          )
          .catch(e => {
            if (
              e instanceof ForeignKeyViolationError &&
              e.constraint.includes('list_id')
            )
              throw new UserInputError(`list with id ${listId} does not exist`)
            failed.push(user_id)
          })
      )
    )

    const list = await query().findById(listId)
    await cache.listUpdated(list.name)

    if (failed.length)
      throw new UserInputError(`couldn't add users ${failed.join(', ')}`)

    return list
  }
)

export const removeFromList = resolver<List>().isAdmin(
  async ({ args: { listId, userId }, query }) => {
    if ((await query.raw(UserLists).findById([userId, listId]).delete()) === 0)
      throw new UserInputError(`user ${userId} is not part of list ${listId}`)
    const list = await query().findById(listId)
    await cache.listUpdated(list.name)
    return list
  }
)

export const changeListInfo = resolver<List>().isAdmin<{
  input: ChangeListInput
}>(async ({ args: { input }, query }) => {
  const list = await query().patchAndFetchById(input.id, {
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
  await cache.listUpdated(list.name)
  return list
})

export const setListPosition = resolver().isAdmin(
  async ({ args: { listId, pos }, query, knex }) => {
    let lists = (await query
      .raw(List)
      .where('sort_pos', '>=', pos)
      .orWhere({ id: listId })) as List[]
    const list = lists.find(({ id }) => id === listId)
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
