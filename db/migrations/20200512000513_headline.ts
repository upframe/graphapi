import * as Knex from 'knex'

export async function up(knex: Knex): Promise<any> {
  await knex.schema.table('mentors', t => {
    t.text('headline')
  })

  const mentors = await knex('mentors').select('id', 'title', 'company')
  const update = mentors
    .filter(({ title }) => title)
    .map(({ id, title, company }) => ({
      id,
      company,
      headline: !company ? title : `${title} at ${company}`,
    }))

  await Promise.all(
    update.map(({ id, headline }) =>
      knex('mentors').update({ headline }).where({ id })
    )
  )

  await knex.schema.table('mentors', t => {
    t.dropColumn('title')
  })
}

export async function down(knex: Knex): Promise<any> {
  await knex.schema.table('mentors', t => {
    t.text('title')
  })

  const mentors = await knex('mentors').select('id', 'company', 'headline')
  const update = mentors
    .filter(({ headline }) => headline)
    .map(({ id, headline, company }) => {
      const [title = ''] = headline.split(' at ')
      return { id, title, company }
    })
  await Promise.all(
    update.map(({ id, title }) =>
      knex('mentors').update({ title }).where({ id })
    )
  )

  await knex.schema.table('mentors', t => {
    t.dropColumn('headline')
  })
}
