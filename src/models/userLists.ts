import { Model, List } from '.'

export class UserLists extends Model {
  static tableName = 'user_lists'
  static idColumn = ['user_id', 'list_id']

  user_id!: string
  list_id!: number
}

import('./user').then(
  ({ User }) =>
    (UserLists.relationMappings = {
      users: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'user_lists.user_id',
          to: 'users.id',
        },
      },
      lists: {
        relation: Model.BelongsToOneRelation,
        modelClass: List,
        join: {
          from: 'user_lists.list_id',
          to: 'lists.id',
        },
      },
    })
)
