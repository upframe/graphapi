import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.table('tokens', t => {
    t.text('payload')
  })
  await knex.schema.raw(
    'ALTER TABLE tokens ADD COLUMN issued timestamp DEFAULT NOW()'
  )
  await knex.schema.raw(
    "ALTER TABLE tokens ADD COLUMN expires timestamp DEFAULT NOW() + INTERVAL '1 day'"
  )
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.table('tokens', t => {
    t.dropColumn('issued')
    t.dropColumn('expires')
    t.dropColumn('payload')
  })
}
