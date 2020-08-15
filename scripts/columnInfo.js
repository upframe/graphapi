const knex = require('knex')
const fs = require('fs')

if (fs.existsSync('.env')) require('dotenv').config()

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  pool: { min: 1, max: 1 },
  acquireConnectionTimeout: 7000,
})

const modelPath = './src/models/'
const tableNames = Array.from(
  new Set(
    fs
      .readdirSync(modelPath)
      .map(file =>
        fs
          .readFileSync(modelPath + file, 'utf-8')
          .match(/static tableName\s*=\s*[\w'"]+/)
      )
      .filter(Boolean)
      .map(([match]) => match.replace(/^.+(?:'|")(\w+).*$/, '$1'))
  )
)

Promise.all(tableNames.map(table => db(table).columnInfo())).then(res => {
  const columns = Object.fromEntries(
    res.map((info, i) => {
      console.log(
        `got ${Object.keys(info).length} columns for ${tableNames[i]}`
      )
      return [tableNames[i], { columns: Object.keys(info) }]
    })
  )
  fs.writeFileSync(
    './db/meta/columns.json',
    JSON.stringify(columns, null, '  ')
  )
  db.destroy()
})
