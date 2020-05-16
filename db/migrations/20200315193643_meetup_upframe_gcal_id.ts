import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.table('meetups', t => {
    t.renameColumn('gcal_event_id', 'gcal_user_event_id')
    t.text('gcal_upframe_event_id').unique()
  })
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.table('meetups', t => {
    t.renameColumn('gcal_user_event_id', 'gcal_event_id')
    t.dropColumn('gcal_upframe_event_id')
  })
}
