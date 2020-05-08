import knex from 'knex'
import { mapValues } from './utils/object'
import logger from './logger'

const db = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
}

const proxy = {
  ...db,
  host: process.env.DB_PROXY_HOST,
}

const connection = process.env.IS_OFFLINE ? db : proxy

logger.info(
  'db-connect',
  mapValues(connection, (v, k) =>
    k === 'password'
      ? v.slice(0, 2) + '*'.repeat(v.length - 4) + v.slice(-2)
      : v
  )
)

export default knex({
  client: 'pg',
  connection,
  pool: { min: 1, max: 1 },
  acquireConnectionTimeout: 7000,
  debug: false,
})
