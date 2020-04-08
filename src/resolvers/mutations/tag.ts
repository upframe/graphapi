import resolver from '../resolver'
import { UserInputError } from '../../error'
import { Tags } from '../../models'
import knex from '../../db'

export const setTagName = resolver<Tags>().isAdmin(
  async ({ query, args: { id, name } }) =>
    (await query().patchAndFetchById(id, { name })) ??
    new UserInputError('unknown tag')
)

export const mergeTags = resolver<Tags>().isAdmin(
  async ({ query, args: { from, into } }) => {
    await knex.transaction(async trx => {
      await trx('user_tags')
        .where({ tag_id: from })
        .update({ tag_id: into })
      await trx('tags')
        .where({ id: from })
        .delete()
    })
    return query().findById(into)
  }
)
