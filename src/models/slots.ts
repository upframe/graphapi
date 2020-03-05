import { Model } from 'objection'

export default class Slots extends Model {
  id!: string
  mentor_id!: string
  start!: string
  end: string

  static tableName = 'time_slots'
  static idColumn = 'id'
}
