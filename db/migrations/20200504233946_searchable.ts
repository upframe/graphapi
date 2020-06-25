import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.table('users', t => {
    t.boolean('searchable').defaultTo(true).notNullable()
  })

  await knex.schema.raw(
    "UPDATE users SET searchable = false WHERE name ilike '%test%'"
  )
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.table('users', t => {
    t.dropColumn('searchable')
  })
}
