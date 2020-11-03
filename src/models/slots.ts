import { Model, Meetup } from '.'

export class Slots extends Model {
  id!: string
  mentor_id!: string
  start!: string
  end: string

  calls?: Meetup[]

  static tableName = 'time_slots'
  static idColumn = 'id'
}

import('./user').then(({ User }) => {
  Slots.relationMappings = {
    calls: {
      relation: Model.HasManyRelation,
      modelClass: Meetup,
      join: {
        from: 'time_slots.id',
        to: 'calls.slot_id',
      },
    },
    user: {
      relation: Model.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'time_slots.mentor_id',
        to: 'users.id',
      },
    },
  }
})
