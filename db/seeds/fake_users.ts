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

  const unique = func => {
    let v
    let it = 0
    do {
      if (it > 100) throw Error("can't generate unique")
      v = func()
      it++
    } while (existing.get(func).includes(v))
    existing.get(func).push(v)
    return v
  }

  let users = []

  const NUM = 500
  for (let i = 0; i < NUM; i++) {
    console.log(`generate user ${i + 1}/${NUM}`)
    faker.locale = i % 3 ? 'en' : faker.random.locale()
    const name = `${faker.name.firstName()} ${faker.name.lastName()}`
    users.push({
      id: uuid(),
      name,
      handle: name.toLowerCase().split(' ').join('.'),
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

  const NUM_IMGS = (NUM / 2) | 0
  const imgs = users.slice(NUM_IMGS).map(({ id }, i) => {
    console.log(`generate image ${i + 1}/${NUM_IMGS}`)
    const url = `https://picsum.photos/seed/${id}/160/160`
    return { user_id: id, url, size: 128, type: 'jpeg' }
  })

  console.log('write user ids to file')
  fs.writeFileSync(
    './db/seeds/data/fake_users.txt',
    fs.readFileSync('./db/seeds/data/fake_users.txt', 'utf-8') +
      '\n\n' +
      users.map(({ id }) => id).join('\n')
  )
  console.log(`insert users ${new Date().toLocaleTimeString()}`)
  await knex('users').insert(users)
  console.log(`insert pictures ${new Date().toLocaleTimeString()}`)
  await knex('profile_pictures').insert(imgs)
}
