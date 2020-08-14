import resolver from '../resolver'
import { UserInputError } from '../../error'
import { Tags } from '../../models'

export const setTagName = resolver<Tags>().isAdmin(
  async ({ query, args: { id, name } }) =>
    (await query().patchAndFetchById(id, { name })) ??
    new UserInputError('unknown tag')
)

export const mergeTags = resolver<Tags>().isAdmin(
  async ({ query, knex, args: { from, into } }) => {
    await knex.transaction(async trx => {
      await trx('user_tags').where({ tag_id: from }).update({ tag_id: into })
      await trx('tags').where({ id: from }).delete()
    })
    return query().findById(into)
  }
)

export const deleteTag = resolver().isAdmin(async ({ query, args: { id } }) => {
  await query.raw(Tags).deleteById(id)
})
