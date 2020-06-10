import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.table('lists', function(t) {
    t.text('description')
  })
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.table('lists', function(t) {
    t.text('description')
  })
}
