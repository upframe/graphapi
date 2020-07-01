import resolver from '../resolver'
import logger from '~/logger'

export const id = resolver<string, any>()(({ parent: { id } }) => id)

export const participants = resolver<any[], any>()(
  async ({ parent: { participants }, args: { includeMe }, ctx, query }) =>
    await query({ entryName: 'Person' }).whereIn(
      'id',
      includeMe ? participants : participants.filter(id => id !== ctx.id)
    )
)

export const channels = resolver<any[], any>()(({ parent }) => {
  logger.info(parent)
  return parent.channels
    ?.sort(
      (a: string, b: string) =>
        parseInt(b.slice(0, -4)) - parseInt(a.slice(0, -4))
    )
    ?.map(id => ({ id }))
})
