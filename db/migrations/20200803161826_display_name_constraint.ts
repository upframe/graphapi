import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.raw(
    'ALTER TABLE users ALTER COLUMN display_name DROP NOT NULL'
  )
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.raw(
    'ALTER TABLE users ALTER COLUMN display_name SET NOT NULL'
  )
}
