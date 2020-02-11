import knex from 'knex'

const get = (name: string) =>
  process.env[`${process.env.IS_OFFLINE ? 'DEV' : 'PROD'}_DB_${name}`]

export default knex({
  client: 'mysql',
  connection: {
    host: get('HOST'),
    user: get('USER'),
    password: get('PASS'),
    database: 'api',
  },
})
