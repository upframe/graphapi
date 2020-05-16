import { Model } from '.'

export class Meetup extends Model {
  slot_id!: string
  status: string
  mentee_id: string
  message: string
  location: string
  gcal_user_event_id: string
  gcal_upframe_event_id: string

  static tableName = 'meetups'
  static idColumn = 'slot_id'

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
