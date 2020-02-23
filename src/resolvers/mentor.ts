import { getClient } from '../calendar'

export default {
  tags: obj => {
    try {
      return JSON.parse(obj.tags).map(({ text }) => text)
    } catch (e) {
      return []
    }
  },

  visibility: ({ newsfeed }) => (newsfeed === 'Y' ? 'LISTED' : 'UNLISTED'),

  notificationPrefs: ({ emailNotifications, availabilityReminder }) => ({
    ...(emailNotifications && {
      receiveEmails: emailNotifications.lastIndexOf(1) !== -1,
    }),
    slotReminder: availabilityReminder?.toUpperCase(),
  }),

  slots: ({ timeSlots }, { after, before }) => {
    if (after) {
      after = new Date(after)
      timeSlots = timeSlots.filter(({ start }) => new Date(start) >= after)
    }
    if (before) {
      before = new Date(before)
      timeSlots = timeSlots.filter(({ start }) => new Date(start) <= before)
    }
    return timeSlots
  },

  calendarConnected: ({ googleRefreshToken, googleAccessToken }) =>
    !!(googleRefreshToken ?? googleAccessToken),

  calendars: async ({ uid, googleRefreshToken }, { ids }) => {
    if (!googleRefreshToken) return
    const client = await getClient(uid, googleRefreshToken)
    if (ids) {
      const res = await Promise.all(
        ids.map(calendarId => client.calendar.calendars.get({ calendarId }))
      )
      return res.map(({ data }) => ({ ...data, uid }))
    }
    const { data } = await client.calendar.calendarList.list()
    return data.items.map(cal => ({ ...cal, uid }))
  },
}
