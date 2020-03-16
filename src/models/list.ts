import { Model } from 'objection'
import User from './user'

export default class List extends Model {
  static tableName = 'lists'
  static idColumn = 'id'

  id!: number
  name!: string

  static relationMapping = {
    users: {
      relation: Model.ManyToManyRelation,
      modelClass: User,
      join: {
        from: 'lists.id',
        through: {
          from: 'user_lists.list_id',
          to: 'user_lists.user_id',
        },
        to: 'users.id',
      },
    },
  }
}
