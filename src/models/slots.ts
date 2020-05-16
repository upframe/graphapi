import { Model, Meetup } from '.'

export class Slots extends Model {
  id!: string
  mentor_id!: string
  start!: string
  end: string

  meetups?: Meetup

  static tableName = 'time_slots'
  static idColumn = 'id'
}

import('./user').then(({ User }) => {
  Slots.relationMappings = {
    meetups: {
      relation: Model.HasOneRelation,
      modelClass: Meetup,
      join: {
        from: 'time_slots.id',
        to: 'meetups.slot_id',
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
