import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.raw('ALTER TABLE users ALTER COLUMN handle TYPE text')
  await knex.raw('ALTER TABLE users ALTER COLUMN email TYPE text')
  await knex.raw('ALTER TABLE users ALTER COLUMN password TYPE char(60)')
  await knex.raw('ALTER TABLE users ALTER COLUMN location TYPE text')
  await knex.raw('ALTER TABLE users ALTER COLUMN biography TYPE text')
  await knex.raw('ALTER TABLE mentors ALTER COLUMN title TYPE text')
  await knex.raw('ALTER TABLE mentors ALTER COLUMN company TYPE text')
  await knex.raw(
    'ALTER TABLE mentors ALTER COLUMN google_refresh_token TYPE text'
  )
  await knex.raw(
    'ALTER TABLE mentors ALTER COLUMN google_access_token TYPE text'
  )
  await knex.raw(
    'ALTER TABLE mentors ALTER COLUMN google_calendar_id TYPE text'
  )
  await knex.raw('ALTER TABLE socialmedia ALTER COLUMN name TYPE text')
  await knex.raw('ALTER TABLE socialmedia ALTER COLUMN url TYPE text')
  await knex.raw('ALTER TABLE user_handles ALTER COLUMN handle TYPE text')
  await knex.raw('ALTER TABLE profile_pictures ALTER COLUMN url TYPE text')
  await knex.raw('ALTER TABLE tags ALTER COLUMN name TYPE text')
  await knex.raw('ALTER TABLE profession ALTER COLUMN name TYPE text')
  await knex.raw('ALTER TABLE meetups ALTER COLUMN message TYPE text')
  await knex.raw('ALTER TABLE meetups ALTER COLUMN location TYPE text')
}

export async function down(knex: Knex): Promise<any> {
  await knex.raw(
    'ALTER TABLE users ALTER COLUMN handle TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE users ALTER COLUMN email TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE users ALTER COLUMN password TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE users ALTER COLUMN location TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE users ALTER COLUMN biography TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE mentors ALTER COLUMN title TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE mentors ALTER COLUMN company TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE mentors ALTER COLUMN google_refresh_token TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE mentors ALTER COLUMN google_access_token TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE mentors ALTER COLUMN google_calendar_id TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE socialmedia ALTER COLUMN name TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE socialmedia ALTER COLUMN url TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE user_handles ALTER COLUMN handle TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE profile_pictures ALTER COLUMN url TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE tags ALTER COLUMN name TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE profession ALTER COLUMN name TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE meetups ALTER COLUMN message TYPE character varying(255)'
  )
  await knex.raw(
    'ALTER TABLE meetups ALTER COLUMN location TYPE character varying(255)'
  )
}
