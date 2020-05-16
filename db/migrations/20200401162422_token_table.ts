import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.createTable('tokens', t => {
    t.specificType('token', 'char(12)').primary()
    t.enum('scope', ['password', 'email', 'signin'], {
      useNative: true,
      enumName: 'token_scope',
    }).notNullable()
    t.uuid('subject')
      .references('users.id')
      .onDelete('cascade')
      .notNullable()
  })
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.dropTable('tokens').raw('DROP TYPE token_scope')
}
