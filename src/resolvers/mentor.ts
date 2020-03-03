import { getClient } from '../calendar'

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

  slots: ({ timeSlots }, { after, before }) => {
    return []
    // if (after) {
    //   after = new Date(after)
    //   timeSlots = timeSlots.filter(({ start }) => new Date(start) >= after)
    // }
    // if (before) {
    //   before = new Date(before)
    //   timeSlots = timeSlots.filter(({ start }) => new Date(start) <= before)
    // }
    // return timeSlots
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
