import { Model } from 'objection'

export default class Meetup extends Model {
  mid!: string
  sid!: string
  mentorUID!: string
  menteeUID!: string
  start!: string
  message: string
  status: string
  location: string
  googleId: string

  static tableName = 'meetups'
  static idColumn = 'mid'

  jsonSchema: {
    type: 'object'
    required: ['mid', 'sid', 'mentorUID', 'menteeUID', 'start']
    properties: {
      status: {
        type: 'string'
        enum: ['confirmed', 'refused', 'pending']
      }
    }
  }
}
