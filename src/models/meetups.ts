import { Model } from 'objection'
import Slots from './slots'

export default class Meetup extends Model {
  slot_id!: string
  status: string
  mentee_id: string
  message: string
  location: string

  static tableName = 'meetups'
  static idColumn = 'slot_id'

  static relationMappings = {
    slots: {
      relation: Model.BelongsToOneRelation,
      modelClass: Slots,
      join: {
        from: 'meetups.slot_id',
        to: 'slots.id',
      },
    },
  }

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
