import { Model } from '.'

export class Space extends Model {
  static tableName = 'spaces'
  static idColumn = 'id'

  id!: string
  name!: string
  handle: string
  description: string
  sidebar: string

  members?: import('./user').User[]
  mentors?: import('./user').User[]
  owners?: import('./user').User[]
  isMember?: boolean
}