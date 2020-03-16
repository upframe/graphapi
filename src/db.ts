import knex from 'knex'
import { replace } from './utils/object'

const get = (name: string) =>
  process.env[`${process.env.IS_OFFLINE ? 'DEV' : 'PROD'}_DB_${name}`]

const port = parseInt(process.env.DB_PORT ?? get('PORT'))

const connection = {
  host: process.env.DB_HOST ?? get('HOST'),
  ...(!isNaN(port) && { port }),
  user: process.env.DB_USER ?? get('USER'),
  password: process.env.DB_PASS ?? get('PASS'),
  database:
    (process.env.NODE_ENV !== 'production'
      ? process.env.DB_NAME_DEV
      : process.env.DEB_NAME_PROD) ?? get('NAME'),
}

console.log(
  replace(connection, {
    password: (v: string) => v.slice(0, 2) + v.slice(2).replace(/./g, '*'),
  })
)

// webpack.DefinePlugin replaces variables at compile time, it doesn't inject them.
// So do not try to dynamically access variables from .env, but explicitly read them!
export default knex({
  client: 'pg',
  connection,
  pool: { min: 0, max: 20 },
  debug: !!process.env.IS_OFFLINE,
})
