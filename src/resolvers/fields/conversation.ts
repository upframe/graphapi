import resolver from '../resolver'

export const id = resolver<string, any>()(({ parent: { id } }) => id)

export const participants = resolver<any[], any>()(
  async ({ parent: { participants }, query }) =>
    await query({ entryName: 'Person' }).whereIn('id', participants)
)

export const channels = resolver<any[], any>()(async () => {
  return []
})
