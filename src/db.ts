import knex from 'knex'
import { replace } from './utils/object'

const connection = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
}

console.log(
  replace(connection, {
    password: (v: string) => v.slice(0, 2) + v.slice(2).replace(/./g, '*'),
  })
)

export default knex({
  client: 'pg',
  connection,
  // @ts-ignore
  pool: { min: 0, max: 20 },
  debug: !!process.env.IS_OFFLINE,
})
