import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.table('users', t => {
    t.text('headline')
  })

  const headlines = await knex('mentors').select('id', 'headline')

  await Promise.all(
    headlines.map(({ id, headline }) =>
      knex.schema.raw(
        `UPDATE users SET headline = '${headline}' WHERE id = '${id}'`
      )
    )
  )
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.table('users', t => {
    t.dropColumn('headline')
  })
}
