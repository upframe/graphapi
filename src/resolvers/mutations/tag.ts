import resolver from '../resolver'
import { UserInputError } from '../../error'
import { Tags } from '../../models'

export const setTagName = resolver<Tags>().isAdmin(
  async ({ query, args: { id, name } }) => {
    if (!id || !name) throw new UserInputError('must provide tag id & name')
    return (
      (await query().patchAndFetchById(id, { name })) ??
      new UserInputError('unknown tag')
    )
  }
)
