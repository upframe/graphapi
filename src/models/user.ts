import { Model } from 'objection'

export default class User extends Model {
  uid!: string
  name!: string
  email!: string
  password!: string

  static tableName = 'users'
  static idColumn = 'uid'
}
