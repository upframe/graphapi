import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.raw('CREATE EXTENSION unaccent;')
  await knex.schema.table('users', t => {
    t.text('name_normalized')
  })
  await knex.schema.raw(`
    CREATE FUNCTION normalize_name() RETURNS TRIGGER AS
    $$
      BEGIN
        UPDATE users set name_normalized = unaccent(name) where id = new.id;
        RETURN NULL;
      END
    $$
    LANGUAGE plpgsql;

    CREATE TRIGGER user_normalize_name 
      AFTER INSERT OR UPDATE OF name ON users
      FOR EACH ROW EXECUTE PROCEDURE normalize_name();

    UPDATE users SET name_normalized = unaccent(name);
  `)

  await knex.schema.raw('DROP INDEX index_users_on_name_trigram;')
  await knex.schema.raw(
    'CREATE INDEX index_users_on_name_trigram ON users USING gin (name gin_trgm_ops, name_normalized gin_trgm_ops);'
  )
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.raw('DROP EXTENSION unaccent;')
  await knex.schema.raw(`
    DROP INDEX index_users_on_name_trigram;
    CREATE INDEX index_users_on_name_trigram ON users USING gin (name gin_trgm_ops);
    DROP TRIGGER user_normalize_name ON users;
    DROP FUNCTION normalize_name;
  `)
  await knex.schema.table('users', t => {
    t.dropColumn('name_normalized')
  })
}
