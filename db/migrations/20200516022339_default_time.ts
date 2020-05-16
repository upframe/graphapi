import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.raw(`
    ALTER TABLE tokens ALTER COLUMN issued SET DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE tokens ALTER COLUMN expires SET DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE invites ALTER COLUMN issued SET DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE signup ALTER COLUMN started SET DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE email_events ALTER COLUMN time SET DEFAULT CURRENT_TIMESTAMP;
  `)
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.raw(`
    ALTER TABLE tokens ALTER COLUMN issued SET DEFAULT NOW();
    ALTER TABLE tokens ALTER COLUMN expires SET DEFAULT NOW();
    ALTER TABLE invites ALTER COLUMN issued SET DEFAULT NOW();
    ALTER TABLE signup ALTER COLUMN started SET DEFAULT NOW();
    ALTER TABLE email_events ALTER COLUMN time SET DEFAULT NOW();
  `)
}
