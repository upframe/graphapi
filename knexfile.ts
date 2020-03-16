require('dotenv').config()
require('ts-node').register({ compilerOptions: { module: 'commonjs' } })

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME_DEV,
    },
    migrations: {
      directory: './db/migrations',
      extension: 'ts',
    },
    seeds: {
      directory: './db/seeds/dev',
      extension: 'ts',
    },
  },
  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME_PROD,
    },
    migrations: {
      directory: './db/migrations',
      extension: 'ts',
    },
    seeds: {
      directory: './db/seeds/prod',
      extension: 'ts',
    },
  },
}
