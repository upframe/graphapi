const path = require('path')

module.exports = {
  extends: ['eslint:recommended', 'prettier/react'],
  parser: '@typescript-eslint/parser',
  plugins: ['prettier', '@typescript-eslint'],
  env: {
    node: true,
    es6: true,
  },
  parserOptions: {
    parser: 'babel-eslint',
    project: path.resolve(__dirname, './tsconfig.json'),
    tsconfigRootDir: __dirname,
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  globals: {
    module: true,
    process: true,
    require: true,
    __dirname: 'readonly',
  },
  rules: {
    semi: ['error', 'never'],
    '@typescript-eslint/no-unused-vars': 'error',
  },
}
