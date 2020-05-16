import { Model } from '.'

export class ProfilePicture extends Model {
  static tableName = 'profile_pictures'
  static idColumn = 'url'

  user_id!: string
  url!: string
  size!: number
  type!: string
}

import('./user').then(({ User }) => {
  ProfilePicture.relationMappings = {
    users: {
      relation: Model.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'profile_pictures.user_id',
        to: 'users.id',
      },
    },
  }
})
