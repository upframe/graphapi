import resolver from '../resolver'

export const total = resolver()<number>(
  async ({ knex }) => (await knex('users').count({ count: '*' }))[0].count
)
