import Query from './queries'
import * as Mutation from './mutations'
import Person from './fields/person'
import Mentor from './fields/mentor'
import Meetup from './fields/meetup'
import { Calendar, Event } from './fields/calendar'
import {
  NotificationPreferences,
  MentorNotificationPreferences,
} from './fields/notificationPreferences'

export default {
  Query,
  Mutation,
  Person,
  Mentor,
  Meetup,
  Calendar,
  Event,
  NotificationPreferences,
  MentorNotificationPreferences,
}
