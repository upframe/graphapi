import { Model } from 'objection'
import knex from '../db'
import Slots from './slots'
import Meetups from './meetups'
import SocialMedia from './socialmedia'
import UserHandles from './userHandles'
import Tags from './tags'
import UserTags from './userTags'
import ProfilePicture from './profilePicture'
import User from './user'
import Mentor from './mentor'
import List from './list'
import UserLists from './userLists'

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
  ProfilePicture,
  List,
  UserLists,
}
