import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.table('lists', function(t) {
    t.text('description')
    t.boolean('public_view')
      .notNullable()
      .defaultTo(true)
    t.string('picture_url')
  })
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.table('lists', function(t) {
    t.dropColumn('description')
    t.dropColumn('public_view')
    t.dropColumn('picture_url')
  })
}
