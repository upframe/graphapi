import { Model } from 'objection'
import knex from '../db'
import User from './user'
import Slots from './slots'
import Meetups from './meetups'

Model.knex(knex)

export { User, Slots, Meetups }
