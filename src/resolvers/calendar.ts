import { getClient } from '../gcal'

const buildDate = (date: string): string => {
  if (date === 'now') return new Date().toISOString()
  if (date === 'today')
    return new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  return date
}

export const Calendar = {
  name: ({ summary }) => summary,

  events: async ({ id, calendarId }, { max, start }) => {
    const client = await getClient(id)
    const { data } = await client.calendar.events.list({
      calendarId,
      maxResults: max,
      timeMin: buildDate(start),
      singleEvents: true,
      orderBy: 'startTime',
    })
    return data.items
  },

  color: ({ backgroundColor }) => backgroundColor,
}

export const Event = {
  name: ({ summary }) => summary,
  start: ({ start }) => start?.dateTime,
  end: ({ end }) => end?.dateTime,
}
