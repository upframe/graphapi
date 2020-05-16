import { Model } from '.'

export class Tokens extends Model {
  static tableName = 'tokens'
  static idColumn = 'token'

  token!: string
  scope!: string
  subject!: string
  payload: string

  static jsonSchema = {
    type: 'object',
    required: ['token', 'scope', 'subject'],
    properties: {
      scope: {
        type: 'string',
        enum: ['password', 'email', 'signin'],
      },
    },
  }
}

import('./user').then(({ User }) => {
  Tokens.relationMappings = {
    users: {
      relation: Model.HasManyRelation,
      modelClass: User,
      join: {
        from: 'tokens.subject',
        to: 'users.id',
      },
    },
  }
})
