import knex from 'knex'

const connection = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
}

export default knex({
  client: 'pg',
  connection,
  // @ts-ignore
  pool: { min: 0, max: 20 },
  debug: false,
})
