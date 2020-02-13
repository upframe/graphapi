import { Model } from 'objection'
import knex from '../db'
import User from './user'

Model.knex(knex)

export { User }
