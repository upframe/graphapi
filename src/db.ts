import knex from 'knex'
import { mapValues } from './utils/object'
import logger from './logger'

const conn_db = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
}

const conn_proxy = {
  ...conn_db,
  host: process.env.DB_PROXY_HOST,
}

const connection = process.env.IS_OFFLINE ? conn_db : conn_proxy

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
  acquireConnectionTimeout: 7000,
  pool: {
    min: 1,
    max: 1,
  },
})
