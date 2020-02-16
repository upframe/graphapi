const fs = require('fs')

fs.writeFileSync(
  './_schema.gql',
  fs
    .readdirSync('./src/schema')
    .filter(file => /\.(gql|graphql)$/.test(file))
    .map(file => fs.readFileSync(`./src/schema/${file}`, 'utf-8'))
    .join('\n\n')
)

module.exports = {
  service: {
    localSchemaFile: './_schema.gql',
  },
}
