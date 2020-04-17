import { getClient } from '../../google'
import * as obj from '../../utils/object'
import { User } from '../../models'

import resolver from '../resolver'
import { ForbiddenError } from 'apollo-server-lambda'

export const visibility = resolver<string, User>()(({ parent: { mentors } }) =>
  typeof mentors?.listed !== 'boolean'
    ? null
    : mentors?.listed
    ? 'LISTED'
    : 'UNLISTED'
)

export const title = resolver<string, User>()(
  ({ parent: { mentors } }) => mentors?.title
)
export const company = resolver<string, User>()(
  ({ parent: { mentors } }) => mentors?.company
)

export const notificationPrefs = resolver<any, User>()(
  ({ parent: { mentors, allow_emails } }) => ({
    slotReminder: mentors?.slot_reminder_email,
    receiveEmails: allow_emails,
  })
)

export const slots = resolver<any, User>()(
  ({ parent: { mentors }, args: { after, before, includeBooked } }) => {
    if (!mentors) return null
    let slots = mentors.time_slots ?? []
    if (!includeBooked) slots = slots.filter(({ meetups }) => !meetups)
    if (after)
      slots = slots.filter(({ start }) => new Date(start) >= new Date(after))
    if (before)
      slots = slots.filter(({ start }) => new Date(start) <= new Date(before))
    return slots.map(slot =>
      obj.mapValues(slot, (v, k) =>
        ['start', 'end'].includes(k) ? (v as Date).toISOString() : v
      )
    )
  }
)

export const calendarConnected = resolver<boolean, User>()(
  ({ parent: { mentors } }) => !!mentors?.google_refresh_token
)

export const calendars = resolver<any[], User>()(
  async ({ parent: { mentors }, ctx: { id }, args: { ids } }) => {
    if (!mentors?.id || id !== mentors.id)
      throw new ForbiddenError('not allowed to access calendars')
    if (!mentors?.google_refresh_token) return null
    const client = await getClient(mentors.id, mentors.google_refresh_token)
    if (ids) {
      const res = await Promise.all(
        ids.map(calendarId =>
          client.calendar.calendars.get({
            calendarId,
          })
        )
      )
      return res.map(({ data }) => ({
        ...data,
        user_id: id,
      }))
    }
    const { data } = await client.calendar.calendarList.list()
    return data.items.map(cal => ({ ...cal, user_id: id }))
  }
)
