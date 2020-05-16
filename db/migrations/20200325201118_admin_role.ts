import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.raw('ALTER TYPE user_role rename TO _user_role')
  await knex.raw(
    "CREATE TYPE user_role AS enum ('user', 'mentor', 'nologin', 'admin')"
  )
  await knex.raw('ALTER TABLE users RENAME COLUMN role TO _role')
  await knex.raw("ALTER TABLE users ADD role user_role NOT NULL default 'user'")
  await knex.raw('UPDATE users SET role = _role::text::user_role')
  await knex.raw('ALTER TABLE users DROP COLUMN _role')
  await knex.raw('DROP TYPE _user_role')
}

export async function down(knex: Knex): Promise<any> {
  await knex.raw('ALTER TYPE user_role rename TO _user_role')
  await knex.raw("CREATE TYPE user_role AS enum ('user', 'mentor', 'nologin')")
  await knex.raw('ALTER TABLE users RENAME COLUMN role TO _role')
  await knex.raw('ALTER TABLE users ADD role user_role NOT NULL')
  await knex.raw("UPDATE users SET role = _role::text::user_role'")
  await knex.raw('ALTER TABLE users DROP COLUMN _role')
  await knex.raw('DROP TYPE _user_role')
}
