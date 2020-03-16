import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.raw(
    'ALTER TABLE user_profession DROP CONSTRAINT user_profession_profession_id_foreign'
  )
  await knex.schema.renameTable('profession', 'lists')
  await knex.schema.renameTable('user_profession', 'user_lists')
  await knex.schema.table('user_lists', t => {
    t.renameColumn('profession_id', 'list_id')
  })
  await knex.raw(
    'ALTER TABLE user_lists ADD CONSTRAINT user_lists_list_id_foreign FOREIGN KEY (list_id) REFERENCES lists (id) ON DELETE CASCADE'
  )
}

export async function down(knex: Knex): Promise<any> {
  await knex.raw(
    'ALTER TABLE user_lists DROP CONSTRAINT user_lists_list_id_foreign'
  )
  await knex.schema.renameTable('lists', 'profession')
  await knex.schema.renameTable('user_lists', 'user_profession')
  await knex.schema.table('user_profession', t => {
    t.renameColumn('list_id', 'profession_id')
  })
  await knex.raw(
    'ALTER TABLE user_profession ADD CONSTRAINT user_profession_profession_id_foreign FOREIGN KEY (profession_id) REFERENCES profession (id) ON DELETE CASCADE'
  )
}
