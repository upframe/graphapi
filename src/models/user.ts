import { Model } from 'objection'

class ProfilePicture extends Model {
  static tableName = 'profilePictures'
}

export default class User extends Model {
  uid!: string
  name!: string
  email!: string
  password!: string

  static tableName = 'users'
  static idColumn = 'uid'

  static relationMappings = {
    profilePictures: {
      relation: Model.HasOneRelation,
      modelClass: ProfilePicture,
      join: {
        from: 'users.uid',
        to: 'profilePictures.uid',
      },
    },
  }
}
