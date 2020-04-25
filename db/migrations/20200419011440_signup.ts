import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.createTable('signup', t => {
    t.string('token')
      .references('invites.id')
      .primary()
    t.timestamp('started').defaultTo('NOW()')
    t.text('email')
    t.text('password')
    t.text('google_id').references('connect_google.google_id')
  })
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.dropTable('signup')
}
