import { Model } from '.'

export class Space extends Model {
  static tableName = 'spaces'
  static idColumn = 'id'

  id!: string
  name!: string
  handle: string
  description: string
  sidebar: string

  users?: import('./user').User[]
}

import('./user').then(
  ({ User }) =>
    (Space.relationMappings = {
      users: {
        relation: Model.ManyToManyRelation,
        modelClass: User,
        join: {
          from: 'spaces.id',
          through: {
            from: 'user_spaces.list_id',
            to: 'user_spaces.user_id',
          },
          to: 'users.id',
        },
      },
    })
)
