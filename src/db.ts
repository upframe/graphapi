import knex from 'knex'
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

export default () =>
  knex({
    client: 'pg',
    connection,
    acquireConnectionTimeout: 7000,
    pool: {
      min: 1,
      max: 1,
      afterCreate(conn, done) {
        conn.on('error', error => {
          logger.error('db connection error', { error })
        })
        done()
      },
    },
  })
