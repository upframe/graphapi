import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.table('mentors', t => {
    t.dropColumn('google_refresh_token')
    t.dropColumn('google_access_token')
    t.dropColumn('google_calendar_id')
  })

  await knex.schema.table('connect_google', t => {
    t.text('calendar_id')
  })

  await knex.schema.raw(
    'ALTER TABLE connect_google ADD CONSTRAINT connect_google_user_id_unique UNIQUE (user_id)'
  )
  await knex.schema.raw(
    'ALTER TABLE signin_upframe ADD CONSTRAINT signin_upframe_user_id_unique UNIQUE (user_id)'
  )
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.table('mentors', t => {
    t.text('google_refresh_token')
    t.text('google_access_token')
    t.text('google_calendar_id')
  })

  await knex.schema.table('connect_google', t => {
    t.dropColumn('calendar_id')
  })

  await knex.schema.raw(
    'ALTER TABLE signin_upframe DROP CONSTRAINT signin_upframe_user_id_unique'
  )
}
