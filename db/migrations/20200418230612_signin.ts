import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.createTable('signin_upframe', t => {
    t.text('email').primary()
    t.text('password').notNullable()
    t.uuid('user_id')
      .references('users.id')
      .onDelete('CASCADE')
  })

  const users = await knex('users').select('id', 'email', 'password')
  await knex('signin_upframe').insert(
    users.map(({ id, email, password }) => ({ user_id: id, email, password }))
  )

  await knex.schema.table('users', t => {
    t.dropColumn('password')
  })

  await knex.schema.createTable('connect_google', t => {
    t.uuid('user_id')
      .references('users.id')
      .onDelete('CASCADE')
    t.text('google_id').primary()
    t.text('refresh_token').notNullable()
    t.text('access_token')
    t.specificType('scopes', 'text[]')
  })
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.table('users', t => {
    t.text('password')
  })

  const passwords = await knex('signin_upframe').select('user_id', 'password')
  await knex.schema.raw(
    `UPDATE USERS AS t SET 
        password = c.password 
      FROM (VALUES 
        ${passwords
          .map(({ user_id, password }) =>
            [`'${user_id}'::uuid`, `'${password}'`].join(',')
          )
          .map(v => `(${v})`)
          .join(',')}
      ) AS c(user_id, password) 
      WHERE c.user_id = t.id`
  )
  await knex.schema.raw('ALTER TABLE users ALTER COLUMN password SET NOT NULL')

  await knex.schema.dropTable('signin_upframe')
  await knex.schema.dropTable('connect_google')
}
