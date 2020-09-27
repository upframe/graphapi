const slsw = require('serverless-webpack')
const webpack = require('webpack')
const fs = require('fs')
const path = require('path')
const nodeExternals = require('webpack-node-externals')

module.exports = {
  entry: slsw.lib.entries,
  target: 'node',
  devtool: slsw.lib.webpack.isLocal ? 'source-map' : 'none',
  mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
  optimization: {
    minimize: !!slsw.lib.webpack.isLocal,
  },
  performance: {
    hints: false,
  },
  resolve: {
    mainFields: ['main', 'module'],
    extensions: ['.ts', '.js'],
    alias: {
      '~': path.resolve(__dirname, 'src'),
    },
  },
  externals: slsw.lib.webpack.isLocal
    ? [nodeExternals()]
    : [
        'aws-sdk',
        'datadog-lambda-js',
        'chalk',
        'knex',
        'bcrypt',
        'mjml',
        'mustache',
        'pg',
        'uuid',
      ],
  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
          },
          {
            loader: 'ts-loader',
          },
        ],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
          },
        ],
      },
      {
        test: /\.(graphql|gql)$/,
        exclude: /node_modules/,
        loader: 'graphql-tag/loader',
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin(
      fs.existsSync('.env')
        ? Object.fromEntries(
            fs
              .readFileSync('.env', 'utf-8')
              .split('\n')
              .filter(Boolean)
              .map(v => v.split('='))
              .map(([k, v]) => [`process.env.${k}`, JSON.stringify(v)])
          )
        : {}
    ),
  ],
}
