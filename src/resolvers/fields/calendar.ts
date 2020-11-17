import resolver from '../resolver'
import type GoogleClient from '~/google/client'

const buildDate = (date: string): string => {
  if (date === 'now') return new Date().toISOString()
  if (date === 'today')
    return new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  return date
}

export const name = resolver<string, any>()(({ parent }) => parent.summary)

export const events = resolver<any[], any>()(
  async ({ parent, args: { max, start } }) => {
    try {
      const {
        data,
      } = await (parent.client as GoogleClient)?.calendar.events.list({
        calendarId: parent.id,
        maxResults: max,
        timeMin: buildDate(start),
        singleEvents: true,
        orderBy: 'startTime',
      })
      return data.items
    } catch (error) {
      logger.error(`couldn't read events from gcal ${parent.id}`, { error })
    }
  }
)

export const color = resolver<string, any>()(
  ({ parent }) => parent.backgroundColor
)

export const access = resolver<string, any>()(
  ({ parent }) => parent?.accessRole
)
