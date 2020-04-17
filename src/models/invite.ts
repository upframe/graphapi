import { Model } from '.'

export class Invite extends Model {
  static tableName = 'invites'
  static idColumn = 'id'

  id!: string
  issuer: string
  email!: string
  role!: string
  redeemed: string
  issued: string
}
