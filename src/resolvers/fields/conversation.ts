import resolver from '../resolver'

export const id = resolver<string, any>()(({ parent: { id } }) => id)

export const participants = resolver<any[], any>()(
  async ({ parent: { participants }, args: { includeMe }, ctx, query }) =>
    await query({ entryName: 'Person' }).whereIn(
      'id',
      includeMe ? participants : participants.filter(id => id !== ctx.id)
    )
)

export const channels = resolver<any[], any>()(({ parent }) =>
  parent.channels
    ?.sort(
      (a: string, b: string) =>
        parseInt(b.slice(0, -4)) - parseInt(a.slice(0, -4))
    )
    ?.map(id => ({ id }))
)

export const created = resolver<string, any>()(({ parent: { created } }) =>
  new Date(created ?? 0).toISOString()
)

export const lastUpdate = resolver<
  string,
  any
>()(({ parent: { lastUpdate } }) => new Date(lastUpdate ?? 0).toISOString())
