import { Model } from 'objection'
import User from './user'
import Slots from './slots'

export default class Mentor extends Model {
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

  static relationMappings = {
    users: {
      relation: Model.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'mentors.id',
        to: 'users.id',
      },
    },
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
