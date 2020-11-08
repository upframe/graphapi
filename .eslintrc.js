const path = require('path')

module.exports = {
  extends: ['eslint:recommended'],
  parser: '@babel/eslint-parser',
  plugins: ['prettier', '@babel', '@typescript-eslint'],
  env: {
    node: true,
    es6: true,
  },
  parserOptions: {
    project: path.resolve(__dirname, './tsconfig.json'),
    tsconfigRootDir: __dirname,
    ecmaVersion: 2018,
    sourceType: 'module',
    createDefaultProgram: true,
  },
  globals: {
    module: true,
    process: true,
    require: true,
    __dirname: 'readonly',
    logger: 'readonly',
  },
  rules: {
    semi: ['error', 'never'],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    'no-unreachable': 'warn',
    'require-await': 'warn',
  },
}
