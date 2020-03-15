import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.table('mentors', t => {
    t.integer('score').defaultTo(0)
  })

  await knex.raw(`
    CREATE FUNCTION slot_count_trg() RETURNS TRIGGER AS
    $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          UPDATE mentors SET score = score + 1 WHERE id = new.mentor_id;
        ELSIF TG_OP = 'DELETE' THEN
          UPDATE mentors SET score = score - 1 WHERE id = old.mentor_id;
        END IF;
        RETURN NULL;
      END
    $$
    LANGUAGE plpgsql;

    CREATE TRIGGER mentor_score AFTER INSERT OR DELETE ON time_slots
      FOR EACH ROW EXECUTE PROCEDURE slot_count_trg();
  `)
}

export async function down(knex: Knex): Promise<any> {
  await knex.raw(`
    DROP TRIGGER user_score ON mentors;
    DROP FUNCTION slot_count_trg;
  `)

  await knex.schema.table('mentors', t => {
    t.dropColumn('score')
  })
}
