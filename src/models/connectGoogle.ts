import { Model } from '.'

export class ConnectGoogle extends Model {
  static tableName = 'connect_google'
  static idColumn = 'google_id'

  google_id!: string
  user_id: string
  refresh_token!: string
  access_token: string
  scopes: string[]
  calendar_id: string
}
