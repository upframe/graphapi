import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.table('users', t => {
    t.text('display_name')
  })

  const users = await knex('users').select('id', 'name')
  await Promise.all(
    users.map(({ id, name }) =>
      knex('users')
        .update({ display_name: name.split(/[\s_.]/)[0] })
        .where({ id })
    )
  )

  await knex.schema.raw(
    `ALTER TABLE users ALTER COLUMN display_name SET NOT NULL`
  )
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.table('users', t => {
    t.dropColumn('display_name')
  })
}
