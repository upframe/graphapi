import resolver from '../resolver'

export const id = resolver<string, any>()(({ parent: { id } }) => id)

export const participants = resolver<any[], any>()(
  async ({ parent: { participants }, args: { includeMe }, ctx, query }) =>
    await query({ entryName: 'Person' }).whereIn(
      'id',
      includeMe ? participants : participants.filter(id => id !== ctx.id)
    )
)

export const channels = resolver<any[], any>()(async () => {
  return []
})
