import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.table('users', t => {
    t.text('headline')
  })

  const headlines = await knex('mentors')
    .select('id', 'headline')
    .whereNot('headline', null)

  await Promise.all(
    headlines
      .filter(({ headline }) => headline)
      .map(({ id, headline }) =>
        knex.schema.raw(
          `UPDATE users SET headline = '${headline.replace(
            /'/g,
            "''"
          )}' WHERE id = '${id}'`
        )
      )
  )
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.table('users', t => {
    t.dropColumn('headline')
  })
}
