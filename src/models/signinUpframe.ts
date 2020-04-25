import { Model } from '.'

export class SigninUpframe extends Model {
  static tableName = 'signin_upframe'
  static idColumn = 'email'

  email!: string
  password!: string
  user_id: string
}
