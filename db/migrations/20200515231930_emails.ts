import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.createTable('emails', t => {
    t.text('id').primary()
    t.text('template').notNullable()
    t.text('subject')
    t.uuid('to_user')
      .references('users.id')
      .onDelete('SET NULL')
    t.text('to_email').notNullable()
  })

  await knex.schema.createTable('email_events', t => {
    t.text('id')
      .references('emails.id')
      .notNullable()
      .onDelete('cascade')
    t.enum(
      'event',
      [
        'queued',
        'clicked',
        'complained',
        'delivered',
        'opened',
        'permanent_fail',
        'temporary_fail',
        'unsubscribed',
      ],
      {
        useNative: true,
        enumName: 'email_event',
      }
    ).notNullable()
    t.timestamp('time')
      .defaultTo('NOW()')
      .notNullable()
  })

  if (process.env.DB_HOST !== 'localhost')
    await knex.schema.raw(`
    GRANT SELECT, UPDATE, INSERT, DELETE ON emails TO email_service;
    GRANT SELECT, UPDATE, INSERT, DELETE ON email_events TO email_service;
  `)

  await knex.schema.table('invites', t => {
    t.text('email_id')
      .references('emails.id')
      .onDelete('SET NULL')
  })
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.table('invites', t => {
    t.dropColumn('email_id')
  })
  await knex.schema.dropTable('email_events')
  await knex.schema.dropTable('emails')
  await knex.schema.raw('DROP TYPE email_event')
}
