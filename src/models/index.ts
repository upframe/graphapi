import { Model } from 'objection'
import knex from '../db'
import User from './user'
import Mentor from './mentor'
import Slots from './slots'
import Meetups from './meetups'
import SocialMedia from './socialmedia'
import UserHandles from './userHandles'
import Tags from './tags'
import UserTags from './userTags'

Model.knex(knex)

export {
  Model,
  User,
  Mentor,
  Slots,
  Meetups,
  SocialMedia,
  UserHandles,
  Tags,
  UserTags,
}
