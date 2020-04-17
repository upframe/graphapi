import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.createTable('invites', t => {
    t.text('id').primary()
    t.uuid('issuer')
      .references('users.id')
      .onDelete('SET NULL')
    t.text('email').notNullable()
    t.specificType('role', 'user_role').notNullable()
    t.uuid('redeemed')
      .references('users.id')
      .onDelete('CASCADE')
    t.timestamp('issued').defaultTo('NOW()')
  })
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.dropTable('invites')
}
