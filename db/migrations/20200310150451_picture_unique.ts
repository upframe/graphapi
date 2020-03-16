import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.raw(
    'ALTER TABLE profile_pictures ADD UNIQUE (user_id, size, type)'
  )
}

export async function down(knex: Knex): Promise<any> {
  await knex.raw(
    'ALTER TABLE profile_pictures DROP CONSTRAINT profile_pictures_user_id_size_type_key'
  )
}
