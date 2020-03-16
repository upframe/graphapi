import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.table('meetups', t => {
    t.text('gcal_event_id').unique()
  })
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.table('meetups', t => {
    t.dropColumn('gcal_event_id')
  })
}
