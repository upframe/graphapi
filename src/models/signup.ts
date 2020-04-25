import { Model } from '.'

export class Signup extends Model {
  static tableName = 'signup'
  static idColumn = 'token'

  token!: string
  timestamp: string
  email: string
  password: string
  google_id: string
}
