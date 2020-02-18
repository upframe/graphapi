import { Model } from 'objection'
import knex from '../db'
import User from './user'
import Slots from './slots'

Model.knex(knex)

export { User, Slots }
