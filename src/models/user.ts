import { Model } from 'objection'
import Slots from './slots'

class ProfilePicture extends Model {
  static tableName = 'profilePictures'
}

const regToStr = (reg: RegExp) => reg.toString().replace(/\/(.*)\//, '$1')

export default class User extends Model {
  uid!: string
  name!: string
  email!: string
  password: string
  keycode: string
  newsfeed: string
  emailNotifications: boolean
  availabilityReminder: string
  type: string
  googleAccessToken: string
  googleRefreshToken: string
  upframeCalendarId: string

  static tableName = 'users'
  static idColumn = 'uid'

  static relationMappings = {
    profilePictures: {
      relation: Model.HasOneRelation,
      modelClass: ProfilePicture,
      join: {
        from: 'users.uid',
        to: 'profilePictures.uid',
      },
    },
    timeSlots: {
      relation: Model.HasManyRelation,
      modelClass: Slots,
      join: {
        from: 'users.uid',
        to: 'timeSlots.mentorUID',
      },
    },
  }

  static jsonSchema = {
    type: 'object',
    required: ['uid', 'name', 'email'],
    properties: {
      uid: {
        type: 'string',
      },
      name: {
        type: 'string',
        minLength: 3,
      },
      email: {
        type: 'string',
        pattern: regToStr(
          /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        ),
      },
      website: {
        type: 'string',
        pattern: regToStr(
          /^(http(s?):\/\/)?[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){0,2}\.[a-z]{2,10}(\/([\w-.~!$&'()*+,;=:@]|(%[0-9a-fA-F]{2}))+)*\/?(\?[^?#]*)?(#(([\w!$&'()*+,;=\-.~:@/?]|(%[0-9a-fA-F]{2}))*))?$/
        ),
      },
      password: {
        type: 'string',
        minLength: 8,
      },
      newsfeed: {
        type: 'string',
        enum: ['Y', 'N'],
      },
      emailNotifications: {
        type: 'boolean',
      },
      availabilityReminder: {
        type: 'string',
        enum: ['monthly', 'weekly', 'off'],
      },
      type: {
        type: 'string',
        enum: ['user', 'mentor'],
      },
    },
  }
}
