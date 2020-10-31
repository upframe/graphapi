import resolver from '../resolver'
import { User, UserTags } from '~/models'
import { UniqueViolationError, ForeignKeyViolationError } from 'objection'
import { UserInputError } from 'apollo-server-lambda'
import { List, UserLists, Mentor } from '../../models'
import wrap, { filterKeys } from '~/utils/object'
import type { ChangeListInput, CreateListInput } from '~/schema/gen/schema'
import * as cache from '~/utils/cache'
import * as account from '~/account'
import logger from '~/logger'
import logEvent from '~/utils/audit'

export const editUserInfo = resolver().isAdmin(
  async ({ args: { userId, info }, query, ctx: { id: editor } }) => {
    const user = await query.raw(User).findById(userId)

    await Promise.all(
      Object.entries(info).map(([field, v]: [string, string]) =>
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
  async ({ args: { listId, userIds }, query, ctx: { id: editor } }) => {
    const removed = await query
      .raw(UserLists)
      .whereInComposite(
        ['user_id', 'list_id'],
        userIds.map((v: number) => [v, listId])
      )
      .delete()
      .returning('user_id')

    await Promise.all(
      removed.map(({ user_id }) =>
        logEvent('admin_edits', {
          editor,
          eventType: 'remove_from_list',
          list: listId,
          user: user_id,
        })
      )
    )

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

export const removeAccounts = resolver().isAdmin(
  async ({ args: { users }, ctx: { id: editor }, query }) => {
    if (users.includes(editor))
      throw new UserInputError(
        `Can't delete own account in admin tools. If you want to perform this action, you can delete this account in your account settings.`
      )

    const remove = async (user: string) => {
      try {
        const userName = await account.remove(user, query)
        await logEvent('admin_edits', {
          editor,
          eventType: 'remove_account',
          user,
          userName,
        })
      } catch (e) {
        logger.warn(`couldn't delete account ${user}`)
        logger.error(e)
      }
    }

    await Promise.allSettled(users.map(remove))
  }
)

export const addUserTags = resolver().isAdmin(
  async ({ args: { users, tags }, ctx: { id: editor }, knex }) => {
    const { rows } = await knex.raw(
      `${knex('user_tags')
        .insert(
          users.flatMap(user_id => tags.map(tag_id => ({ user_id, tag_id })))
        )
        .toString()} ON CONFLICT DO NOTHING RETURNING *`
    )

    await Promise.all(
      rows.map(({ user_id, tag_id }) =>
        logEvent('admin_edits', {
          editor,
          eventType: 'add_tag',
          user: user_id,
          tag: tag_id,
        })
      )
    )
  }
)

export const removeUserTags = resolver().isAdmin(
  async ({ args: { users, tags }, ctx: { id: editor }, query }) => {
    const queryArgs = users.flatMap((user_id: string) =>
      tags.map((tag_id: number) => [user_id, tag_id])
    )
    const removed = await query
      .raw(UserTags)
      .whereInComposite(['user_id', 'tag_id'], queryArgs)
      .delete()
      .returning('*')

    await Promise.all(
      removed.map(({ user_id, tag_id }) =>
        logEvent('admin_edits', {
          editor,
          eventType: 'remove_tag',
          user: user_id,
          tag: tag_id,
        })
      )
    )
  }
)

export const setUserRole = resolver<User>().isAdmin(
  async ({ args: { userId, role }, query, ctx: { id: editor } }) => {
    const user = await query.raw(User).findById(userId)
    if (!user) throw new UserInputError(`unknown user ${userId}`)
    role = role.toLowerCase()
    if (user.role === role)
      throw new UserInputError(`user ${user.name} already has role ${role}`)

    if (
      ['mentor', 'admin'].includes(role) &&
      !['mentor', 'admin'].includes(user.role)
    )
      await query.raw(Mentor).insert({ id: userId, listed: false })
    else if (role === 'user' && ['mentor', 'admin'].includes(user.role))
      await query.raw(Mentor).deleteById(userId)

    await query.raw(User).findById(userId).patch({ role })

    await logEvent('admin_edits', {
      editor,
      eventType: 'set_role',
      user: userId,
      old: user.role,
      new: role,
    })

    return query().findById(userId)
  }
)
