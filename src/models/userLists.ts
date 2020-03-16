import { Model } from 'objection'
import List from './list'
import User from './user'

export default class UserLists extends Model {
  static tableName = 'user_lists'
  static idColumn = ['user_id', 'list_id']

  user_id!: string
  list_id!: number

  static relationMappings = {
    users: {
      relation: Model.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'user_lists.user_id',
        to: 'users.id',
      },
    },
    list: {
      relation: Model.BelongsToOneRelation,
      modelClass: List,
      join: {
        from: 'user_lists.list_id',
        to: 'lists.id',
      },
    },
  }
}
