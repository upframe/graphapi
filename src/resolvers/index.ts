import * as Query from './queries'
import * as Mutation from './mutations'
import * as Subscription from './subscriptions'
import * as Person from './fields/person'
import * as Mentor from './fields/mentor'
import * as Meetup from './fields/meetup'
import * as Calendar from './fields/calendar'
import * as Event from './fields/event'
import * as NotificationPreferences from './fields/notificationPreferences'
import * as MentorNotificationPreferences from './fields/mentorNotificationPreferences'
import * as Message from './fields/message'
import * as Channel from './fields/channel'
import { Connection, Edge, Node } from './fields/connections'
import * as Timezone from './fields/timezone'
import * as Conversation from './fields/conversation'
import * as List from './fields/list'
import * as UserConnection from './fields/userList'
import * as Space from './fields/space'

export default {
  Query,
  Mutation,
  Subscription,
  Person,
  Mentor,
  Meetup,
  Calendar,
  Event,
  NotificationPreferences,
  MentorNotificationPreferences,
  Message,
  Channel,
  Connection,
  Edge,
  Node,
  Timezone,
  Conversation,
  List,
  UserConnection,
  Space,
}
