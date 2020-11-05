import { Model } from '.'
import type { Slots } from './slots'

export class Meetup extends Model {
  id!: string
  slot_id!: string
  status: string
  mentee_id: string
  message: string
  location: string
  gcal_user_event_id: string
  gcal_upframe_event_id: string

  slot?: Slots

  static tableName = 'calls'
  static idColumn = 'id'

  jsonSchema: {
    type: 'object'
    required: ['slot_id']
    properties: {
      status: {
        type: 'string'
        enum: ['pending', 'confirmed', 'cancelled']
      }
    }
  }
}

import('./slots').then(({ Slots }) => {
  Meetup.relationMappings = {
    slot: {
      relation: Model.BelongsToOneRelation,
      modelClass: Slots,
      join: {
        from: 'calls.slot_id',
        to: 'time_slots.id',
      },
    },
  }
})
