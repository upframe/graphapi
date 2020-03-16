import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.createTable('profile_pictures', t => {
    t.uuid('user_id')
      .references('users.id')
      .onDelete('cascade')
    t.string('url').primary()
    t.specificType('size', 'smallint')
    t.enum('type', ['jpeg', 'webp'], {
      useNative: true,
      enumName: 'img_type',
    })
  })

  await knex.schema.createTable('tags', t => {
    t.specificType('id', 'serial').primary()
    t.string('name').unique()
  })
  await knex.schema.createTable('user_tags', t => {
    t.uuid('user_id')
      .references('users.id')
      .onDelete('cascade')
    t.specificType('tag_id', 'serial')
      .references('tags.id')
      .onDelete('cascade')

    t.primary(['user_id', 'tag_id'])
  })

  await knex.schema.createTable('profession', t => {
    t.specificType('id', 'serial').primary()
    t.string('name').unique()
  })
  await knex.schema.createTable('user_profession', t => {
    t.uuid('user_id')
      .references('users.id')
      .onDelete('cascade')
    t.specificType('profession_id', 'serial')
      .references('profession.id')
      .onDelete('cascade')

    t.primary(['user_id', 'profession_id'])
  })

  await knex.schema.createTable('socialmedia', t => {
    t.specificType('id', 'serial').primary()
    t.string('name').unique()
    t.string('url').unique()
  })
  await knex.schema.createTable('user_handles', t => {
    t.uuid('user_id')
      .references('users.id')
      .onDelete('cascade')
    t.specificType('platform_id', 'serial')
      .references('socialmedia.id')
      .onDelete('cascade')
    t.string('handle').notNullable()

    t.primary(['user_id', 'platform_id'])
    t.unique(['platform_id', 'handle'])
  })

  await knex.schema.createTable('mentors', t => {
    t.uuid('id')
      .primary()
      .references('users.id')
      .onDelete('cascade')
  })

  await knex.schema.createTable('time_slots', t => {
    t.uuid('id').primary()
    t.uuid('mentor_id')
      .references('mentors.id')
      .onDelete('cascade')
    t.dateTime('start').notNullable()
    t.dateTime('end')
  })

  await knex.schema.createTable('meetups', t => {
    t.uuid('slot_id')
      .primary()
      .references('time_slots.id')
      .onDelete('cascade')
    t.enum('status', ['pending', 'confirmed', 'cancelled'], {
      useNative: true,
      enumName: 'meetup_status',
    }).defaultTo('pending')
    t.uuid('mentee_id')
      .references('users.id')
      .onDelete('cascade')
    t.string('message')
    t.string('location')
  })
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.dropTable('profile_pictures').raw('DROP TYPE img_type')
  await knex.schema.dropTable('user_tags')
  await knex.schema.dropTable('tags')
  await knex.schema.dropTable('user_profession')
  await knex.schema.dropTable('profession')
  await knex.schema.dropTable('user_handles')
  await knex.schema.dropTable('socialmedia')
  await knex.schema.dropTable('meetups').raw('DROP TYPE meetup_status')
  await knex.schema.dropTable('time_slots')
  await knex.schema.dropTable('mentors')
}
