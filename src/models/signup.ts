import { Model } from '.'

export class Signup extends Model {
  id!: string
  token!: string
  timestamp: string
  email: string
  password: string
  google_id: string

  static tableName = 'signup'
  static idColumn = 'id'
}
