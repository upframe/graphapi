import * as Knex from 'knex'
import axios from 'axios'

export async function seed(knex: Knex): Promise<any> {
  const { data } = await axios(
    'https://data.stackexchange.com/stackoverflow/csv/1321129'
  )
  const tags = data
    .split('\n')
    .slice(1)
    .map(v => v.split(',')[0].replace(/^"(.+)"$/, '$1'))

  await knex.raw(
    `${knex('tags')
      .insert(tags.map(name => ({ name })))
      .toString()} ON CONFLICT DO NOTHING`
  )
}
