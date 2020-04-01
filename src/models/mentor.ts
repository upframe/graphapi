import { Model, Slots } from '.'

export class Mentor extends Model {
  static tableName = 'mentors'
  static idColumn = 'id'

  id!: string
  listed: boolean
  title: string
  company: string
  google_refresh_token: string
  google_access_token: string
  google_calendar_id: string
  slot_reminder_email: string

  time_slots?: Slots[]

  static relationMappings = {
    time_slots: {
      relation: Model.HasManyRelation,
      modelClass: Slots,
      join: {
        from: 'mentors.id',
        to: 'time_slots.mentor_id',
      },
    },
  }
}
