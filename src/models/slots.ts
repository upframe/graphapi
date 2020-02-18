import { Model } from 'objection'

export default class Slots extends Model {
  sid!: string
  mentorUID!: string
  start!: string
  end: string

  static tableName = 'timeSlots'
  static idColumn = 'sid'
}
