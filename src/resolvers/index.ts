import query from '../utils/buildQuery'
import * as queries from './queries'
import * as Mutation from './mutations'
import Person from './fields/person'
import Mentor from './fields/mentor'
import Meetup from './fields/meetup'
import { Calendar, Event } from './fields/calendar'
import {
  NotificationPreferences,
  MentorNotificationPreferences,
} from './fields/notificationPreferences'

const resolver = (handler: Resolver) => (
  parent: any,
  args: any,
  ctx: any,
  info: any
) =>
  handler({
    query: Object.assign((options = {}) => query(info, { ...options, ctx }), {
      raw: () => query.raw(info, ctx),
    }),
    parent,
    args,
    ctx,
  })

export default {
  Query: Object.fromEntries(
    Object.entries(queries).map(([k, v]) => [k, resolver(v)])
  ),
  Mutation: Object.fromEntries(
    Object.entries(Mutation).map(([k, v]) => {
      if (k === 'createList') return [k, resolver(v)]
      return [k, v]
    })
  ),
  Person,
  Mentor,
  Meetup,
  Calendar,
  Event,
  NotificationPreferences,
  MentorNotificationPreferences,
}
