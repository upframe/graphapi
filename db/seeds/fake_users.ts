import * as Knex from 'knex'
import faker from 'faker'
import uuid from 'uuid/v4'
import * as bcrypt from 'bcrypt'
import fs from 'fs'

export async function seed(knex: Knex): Promise<any> {
  const existing = new Map()
  existing.set(
    faker.internet.email,
    (await knex('users').select('email')).map(({ email }) => email)
  )
  existing.set(
    faker.image.avatar,
    (await knex('profile_pictures').select('url')).map(({ url }) => url)
  )

  const unique = func => {
    let v
    let it = 0
    do {
      if (it > 20) throw Error(`can't generate unique ${func}`)
      v = func()
    } while (existing.get(func).includes(v))
    existing.get(func).push(v)
    return v
  }

  let users = []

  for (let i = 0; i < 500; i++) {
    faker.locale = i % 3 ? 'en' : faker.random.locale()
    const name = `${faker.name.firstName()} ${faker.name.lastName()}`
    users.push({
      id: uuid(),
      name,
      handle: name
        .toLowerCase()
        .split(' ')
        .join('.'),
      email: unique(faker.internet.email),
      location: faker.address.city(),
      biography: faker.lorem.text(),
      ...(Math.random() < 0.2 && {
        website: faker.internet.url(),
      }),
      role: 'user',
      password: bcrypt.hashSync('password', bcrypt.genSaltSync(10)),
      allow_emails: false,
    })
  }

  const imgs = users.slice((users.length / 2) | 0).map(({ id }) => {
    const url = unique(faker.image.avatar)
    return { user_id: id, url, size: 128, type: 'jpeg' }
  })

  fs.writeFileSync(
    './db/seeds/data/fake_users.txt',
    fs.readFileSync('./db/seeds/data/fake_users.txt', 'utf-8') +
      '\n\n' +
      users.map(({ id }) => id).join('\n')
  )
  await knex('users').insert(users)
  await knex('profile_pictures').insert(imgs)
}
