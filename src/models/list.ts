import { Model } from '.'

export class List extends Model {
  static tableName = 'lists'
  static idColumn = 'id'

  id!: number
  name!: string
  description: string
  picture_url: string
  public_view!: boolean
  background_color: string
  text_color: string
  users?: import('./user').User[]
}

import('./user').then(
  ({ User }) =>
    (List.relationMappings = {
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
    })
)
