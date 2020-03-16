import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.table('mentors', t => {
    t.boolean('listed')
      .defaultTo(false)
      .notNullable()
    t.string('title')
    t.string('company')
    t.string('google_refresh_token')
    t.string('google_access_token')
    t.string('google_calendar_id')
    t.enum('slot_reminder_email', ['off', 'weekly', 'monthly'], {
      useNative: true,
      enumName: 'slot_reminder_frequency',
    })
  })

  await knex.schema.table('users', t => {
    t.string('location')
    t.string('biography')
    t.boolean('allow_emails')
      .defaultTo(true)
      .notNullable()
  })
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.table('mentors', t => {
    t.dropColumn('listed')
    t.dropColumn('title')
    t.dropColumn('company')
    t.dropColumn('google_refresh_token')
    t.dropColumn('google_access_token')
    t.dropColumn('google_calendar_id')
    t.dropColumn('slot_reminder_email')
  })
  await knex.schema.raw('DROP TYPE slot_reminder_frequency')

  await knex.schema.table('users', t => {
    t.dropColumn('location')
    t.dropColumn('biography')
    t.dropColumn('allow_emails')
  })
}
