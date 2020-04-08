import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.raw(
    'CREATE INDEX index_tags_on_name_trigram ON tags USING gin (name gin_trgm_ops);'
  )
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.raw('DROP INDEX index_tags_on_name_trigram;')
}
