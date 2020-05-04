import knex from 'knex'
import tracer from './tracer'

const connection = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
}

const db = knex({
  client: 'pg',
  connection,
  // @ts-ignore
  pool: { min: 0, max: 20 },
  debug: false,
})

let queries: {
  [id: string]: ReturnType<typeof tracer.startSpan>
} = {}

db.on('query', ({ __knexQueryUid }) => {
  queries[__knexQueryUid] = tracer.startSpan('db.query')
})

db.on('query-response', (_, { __knexQueryUid, sql }) => {
  queries[__knexQueryUid].addTags({ sqlquery: sql })
  queries[__knexQueryUid].finish()
  delete queries[__knexQueryUid]
})

db.on('query-error', (_, { __knexQueryUid, sql }) => {
  queries[__knexQueryUid].addTags({ sqlquery: sql })
  queries[__knexQueryUid].finish()
  delete queries[__knexQueryUid]
})

export default db
