import { Model } from 'objection'
import User from './user'
import Tags from './tags'

export default class UserTags extends Model {
  static tableName = 'user_tags'
  static idColumn = ['user_id', 'platform_id']

  user_id!: string
  tag_id!: number

  static relationMappings = {
    users: {
      relation: Model.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'user_tags.user_id',
        to: 'users.id',
      },
    },
    tags: {
      relation: Model.BelongsToOneRelation,
      modelClass: Tags,
      join: {
        from: 'user_tags.tag_id',
        to: 'tags.id',
      },
    },
  }
}
