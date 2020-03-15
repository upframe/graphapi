import { getClient } from '../../gcal'
import * as obj from '../../utils/object'
import { Slots } from '../../models'

export default {
  visibility: ({ mentors, visibility = mentors?.visibility }) =>
    visibility ? 'LISTED' : 'UNLISTED',

  title: ({ mentors, title = mentors?.title }) => title,
  company: ({ mentors, company = mentors?.company }) => company,

  notificationPrefs: ({
    allow_emails,
    slot_reminder_email,
    mentors,
    ...parent
  }) => ({
    slotReminder: slot_reminder_email || mentors?.slot_reminder_email,
    receiveEmails: allow_emails,
    ...parent,
  }),

  slots: async ({ id }, { after, before, includeBooked }) => {
    let slots = await Slots.query()
      .where({ mentor_id: id })
      .withGraphFetched('meetups')

    if (!includeBooked) slots = slots.filter(({ meetups }) => meetups === null)

    if (after)
      slots = slots.filter(({ start }) => new Date(start) >= new Date(after))
    if (before)
      slots = slots.filter(({ start }) => new Date(start) <= new Date(before))

    return slots.map(slot =>
      obj.mapValues(slot, (v, k) =>
        ['start', 'end'].includes(k) ? (v as Date).toISOString() : v
      )
    )
  },

  calendarConnected: ({
    mentors,
    google_refresh_token = mentors?.google_refresh_token,
  }) => !!google_refresh_token,

  calendars: async (
    { id, mentors, google_refresh_token = mentors?.google_refresh_token },
    { ids }
  ) => {
    if (!google_refresh_token) return
    const client = await getClient(id, google_refresh_token)
    if (ids) {
      const res = await Promise.all(
        ids.map(calendarId => client.calendar.calendars.get({ calendarId }))
      )
      return res.map(({ data }) => ({ ...data, user_id: id }))
    }
    const { data } = await client.calendar.calendarList.list()
    return data.items.map(cal => ({ ...cal, user_id: id }))
  },

  categories: ({ category }) => category?.split(',') ?? [],
}
