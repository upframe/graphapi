import { Model, Slots } from '.'

export class Mentor extends Model {
  static tableName = 'mentors'
  static idColumn = 'id'

  id!: string
  listed: boolean
  company: string
  slot_reminder_email: string
  score: number

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
