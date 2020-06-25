import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.table('users', t => {
    t.text('timezone')
    t.boolean('tz_infer').notNullable().defaultTo(true)
  })
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.table('users', t => {
    t.dropColumn('timezone')
    t.dropColumn('tz_infer')
  })
}
