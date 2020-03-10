import * as Knex from 'knex'

export async function seed(knex: Knex): Promise<any> {
  const users = await knex('users')
  await Promise.all(
    users
      .filter(({ biography }) => biography)
      .map(({ id, biography }) =>
        knex('users')
          .where({ id })
          .update({ biography: biography.replace(/\\n/g, '\n') })
      )
  )
}
