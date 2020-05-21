import { userClient } from '../../google'
import resolver from '../resolver'

const buildDate = (date: string): string => {
  if (date === 'now') return new Date().toISOString()
  if (date === 'today')
    return new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  return date
}

export const name = resolver<string, any>()(({ parent }) => parent.summary)

export const events = resolver<any[], any>()(
  async ({ parent, args: { max, start }, knex }) => {
    const client = await userClient(knex, parent)
    const { data } = await client.calendar.events.list({
      calendarId: parent.id,
      maxResults: max,
      timeMin: buildDate(start),
      singleEvents: true,
      orderBy: 'startTime',
    })
    return data.items
  }
)

export const color = resolver<string, any>()(
  ({ parent }) => parent.backgroundColor
)
