import * as Knex from 'knex'
const fs = require('fs')
const uuid = require('uuid/v4')

const [columns, ...rows] = fs
  .readFileSync('./db/seeds/data/raw.txt', 'utf-8')
  .split('\n')
  .map(v => v.split('\t'))

const data = rows
  .slice(0, -1)
  .map(row => row.map((v, i) => [columns[i], v]))
  .map(Object.fromEntries)
  .filter(({ type }) => type === 'mentor')
  .map(obj => ({ ...obj, uid: uuid() }))

const profession = Array.from(
  new Set(
    data.flatMap(({ category }) =>
      category.split(',').filter(v => v !== 'NULL')
    )
  )
)

const tags = Array.from(
  new Set(
    data
      .map(({ tags }) => JSON.parse(tags || '[]'))
      .flatMap(tags => tags.map(({ text }) => text.toLowerCase()))
  )
)

const social_media = [
  { name: 'Facebook', url: 'https://facebook.com/' },
  { name: 'Twitter', url: 'https://twitter.com/' },
  { name: 'GitHub', url: 'https://github.com/' },
  { name: 'LinkedIn', url: 'https://linkedin.com/in/' },
  { name: 'Dribbble', url: 'https://dribbble.com/' },
]

export async function seed(knex: Knex): Promise<any> {
  await knex('socialmedia').del()
  await knex.schema.raw('alter sequence socialmedia_id_seq restart')

  await knex('users').del()
  await knex('users').insert(
    data.map(
      ({
        uid,
        keycode,
        name,
        email,
        password,
        location,
        bio,
        emailNotifications,
      }) => ({
        id: uid,
        handle: keycode,
        name,
        email,
        password,
        role: 'mentor',
        location,
        biography: bio,
        allow_emails: emailNotifications === '\u0001',
      })
    )
  )

  await knex('mentors').del()
  await knex('mentors').insert(
    data.map(({ uid, newsfeed, role, company, availabilityReminder }) => ({
      id: uid,
      listed: newsfeed === 'Y',
      ...(role && { title: role }),
      ...(company && { company }),
      slot_reminder_email: availabilityReminder,
    }))
  )

  await knex('profession').del()
  await knex.schema.raw('alter sequence profession_id_seq restart')
  await knex('profession').insert(profession.map(name => ({ name })))

  await knex('user_profession').del()
  await knex('user_profession').insert(
    data.flatMap(({ uid, category }) =>
      category
        .split(',')
        .filter(v => v !== 'NULL')
        .map(v => profession.indexOf(v) + 1)
        .map(profession_id => ({ user_id: uid, profession_id }))
    )
  )

  await knex('tags').del()
  await knex.schema.raw('alter sequence tags_id_seq restart')
  await knex('tags').insert(tags.map(name => ({ name })))

  await knex('user_tags').del()
  await knex('user_tags').insert(
    data.flatMap(({ uid, tags: userTags }) =>
      JSON.parse(userTags || '[]')
        .map(({ text }) => text.toLowerCase())
        .map(tag => ({ user_id: uid, tag_id: tags.indexOf(tag) + 1 }))
    )
  )

  await knex('socialmedia').delete()
  await knex('socialmedia').insert(social_media)

  await knex('user_handles').del()
  await knex('user_handles').insert(
    data.flatMap(({ uid, ...user }) =>
      social_media
        .map(({ name }, i) => ({
          user_id: uid,
          platform_id: i + 1,
          handle: user[name.toLowerCase()],
        }))
        .filter(({ handle }) => handle)
        .map(({ handle, ...v }) => ({
          ...v,
          handle: handle
            .replace(/^(.+)\/$/, '$1')
            .split('/')
            .pop()
            .replace(/^@(.+)/, '$1'),
        }))
        .filter(({ handle }) => !['-', 'nope'].includes(handle.toLowerCase()))
    )
  )
}
