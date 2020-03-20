import { Model, User } from '.'

export class Tags extends Model {
  static tableName = 'tags'
  static idColumn = 'id'

  id!: number
  name!: string

  static relationMappings = {
    users: {
      relation: Model.HasManyRelation,
      modelClass: User,
      join: {
        from: 'tags.id',
        through: {
          from: 'user_tags.tag_id',
          to: 'user_tags.user_id',
        },
        to: 'users.id',
      },
    },
  }
}
