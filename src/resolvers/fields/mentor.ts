import * as obj from '~/utils/object'
import { User } from '~/models'
import resolver from '../resolver'

export const visibility = resolver<string, User>()(({ parent: { mentors } }) =>
  typeof mentors?.listed !== 'boolean'
    ? null
    : mentors?.listed
    ? 'LISTED'
    : 'UNLISTED'
)

export const company = resolver<string, User>()(
  ({ parent: { mentors } }) => mentors?.company
)

export const notificationPrefs = resolver<any, User>()(
  ({ parent: { mentors, allow_emails, msg_emails } }) => ({
    slotReminder: mentors?.slot_reminder_email,
    msgEmails: msg_emails,
    receiveEmails: allow_emails,
  })
)

export const slots = resolver<any, User>()(
  ({ parent: { mentors }, args: { after, before, includeBooked } }) => {
    if (!mentors) return null
    let slots = mentors.time_slots ?? []
    if (!includeBooked)
      slots = slots.filter(
        ({ calls }) => !calls?.some(({ status }) => status !== 'cancelled')
      )
    if (after)
      slots = slots.filter(({ start }) => new Date(start) >= new Date(after))
    if (before)
      slots = slots.filter(({ start }) => new Date(start) <= new Date(before))
    return slots.map(slot =>
      obj.mapValues(slot, (v, k) =>
        ['start', 'end'].includes(k)
          ? ((v as unknown) as Date).toISOString()
          : v
      )
    )
  }
)
