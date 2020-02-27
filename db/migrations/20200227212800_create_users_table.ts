import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  return knex.schema.createTable('users', t => {
    t.uuid('id').primary()
    t.string('handle').notNullable()
    t.string('name').notNullable()
    t.string('email')
      .unique()
      .notNullable()
    t.string('password').notNullable()
    t.enum('role', ['user', 'mentor', 'nologin'], {
      useNative: true,
      enumName: 'user_role',
    }).notNullable()
  })
}

export async function down(knex: Knex): Promise<any> {
  return knex.schema.dropTable('users').raw('DROP TYPE user_role')
}
