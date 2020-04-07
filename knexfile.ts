require('dotenv').config()
require('ts-node').register({ compilerOptions: { module: 'commonjs' } })

module.exports = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  },
  migrations: {
    directory: './db/migrations',
    extension: 'ts',
  },
  seeds: {
    directory: './db/seeds',
    extension: 'ts',
  },
}
