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
    // @ts-ignore
    query: Object.assign((options = {}) => query(info, { ...options, ctx }), {
      raw: (model?: any) => query.raw(info, ctx, model),
    }),
    parent,
    args,
    ctx,
  })

export default {
  Query: Object.fromEntries(
    Object.entries(queries).map(([k, v]) => [k, resolver(v as any)])
  ),
  Mutation: Object.fromEntries(
    Object.entries(Mutation).map(([k, v]) => [
      k,
      k.toLowerCase().includes('list') ||
      [
        'updateProfile',
        'setProfileVisibility',
        'updateNotificationPreferences',
      ].includes(k)
        ? resolver(v as Resolver)
        : v,
    ])
  ),
  Person,
  Mentor,
  Meetup,
  Calendar,
  Event,
  NotificationPreferences,
  MentorNotificationPreferences,
}
