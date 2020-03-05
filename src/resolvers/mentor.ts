import { getClient } from '../gcal'
import * as obj from '../utils/object'

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

  slots: ({ time_slots }, { after, before }) => {
    if (after)
      time_slots = time_slots.filter(({ start }) => start >= new Date(after))
    if (before)
      time_slots = time_slots.filter(({ start }) => start <= new Date(before))

    return time_slots.map(slot =>
      obj.mapValues(slot, (v, k) =>
        ['start', 'end'].includes(k) ? (v as Date).toISOString() : v
      )
    )
  },

  calendarConnected: ({ googleRefreshToken, googleAccessToken }) =>
    !!(googleRefreshToken ?? googleAccessToken),

  calendars: async ({ id, googleRefreshToken }, { ids }) => {
    if (!googleRefreshToken) return
    const client = await getClient(id, googleRefreshToken)
    if (ids) {
      const res = await Promise.all(
        ids.map(calendarId => client.calendar.calendars.get({ calendarId }))
      )
      return res.map(({ data }) => ({ ...data, id }))
    }
    const { data } = await client.calendar.calendarList.list()
    return data.items.map(cal => ({ ...cal, id }))
  },

  categories: ({ category }) => category?.split(',') ?? [],
}
