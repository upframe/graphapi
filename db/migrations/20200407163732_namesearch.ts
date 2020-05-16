import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.raw('CREATE EXTENSION pg_trgm;')
  await knex.schema.raw(
    'CREATE INDEX index_users_on_name_trigram ON users USING gin (name gin_trgm_ops);'
  )
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.raw('DROP INDEX index_users_on_name_trigram;')
  await knex.schema.raw('DROP EXTENSION pg_trgm;')
}
