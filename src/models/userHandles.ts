import { Model, User, SocialMedia } from '.'

export class UserHandles extends Model {
  static tableName = 'user_handles'
  static idColumn = ['user_id', 'platform_id']

  user_id!: string
  platform_id!: number
  handle!: string

  static relationMappings = {
    users: {
      relation: Model.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'user_handles.user_id',
        to: 'users.id',
      },
    },
    socialmedia: {
      relation: Model.BelongsToOneRelation,
      modelClass: SocialMedia,
      join: {
        from: 'user_handles.platform_id',
        to: 'socialmedia.id',
      },
    },
  }
}
