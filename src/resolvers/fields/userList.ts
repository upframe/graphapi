import resolver from '../resolver'

export const total = resolver<number, any>()(
  async ({ knex, parent: { total } }) =>
    total ?? (await knex('users').count({ count: '*' }))[0].count
)
