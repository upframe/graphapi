import { Model } from 'objection'
import User from './user'

export default class SocialMedia extends Model {
  static tableName = 'socialmedia'
  static idColumn = 'id'

  id!: number
  name!: string
  url: string

  static relationMappings = {
    users: {
      relation: Model.HasManyRelation,
      modelClass: User,
      join: {
        from: 'socialmedia.id',
        through: {
          from: 'user_handles.platform_id',
          to: 'user_handles.user_id',
        },
        to: 'users.id',
      },
    },
  }
}
