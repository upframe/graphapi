import resolver from '../resolver'

export const total = resolver<number, any>()(
  async ({ knex, parent: { total, totalQuery } }) =>
    total ??
    (await (totalQuery ?? knex('users')).count({ count: '*' }))[0].count
)
