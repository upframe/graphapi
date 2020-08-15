const fs = require('fs')

fs.rmdirSync('src/schema/gen', { recursive: true })
fs.mkdirSync('src/schema/gen')

const readGqlFiles = path =>
  fs.readdirSync(path).flatMap(file => {
    return fs.lstatSync(path + file).isDirectory()
      ? readGqlFiles(path + file + '/')
      : /\.(gql|graphql)$/.test(file)
      ? (console.log(`read ${path + file}`),
        fs.readFileSync(path + file, 'utf-8'))
      : []
  })

const files = readGqlFiles('src/schema/')

fs.writeFileSync('src/schema/gen/_schema.gql', files.join('\n\n'))
