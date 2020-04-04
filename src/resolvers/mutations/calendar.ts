import { User, Mentor } from '../../models'
import { getClient, removeClient } from '../../gcal'
import { UserInputError } from '../../error'
import resolver from '../resolver'

export const connectCalendar = resolver<User>().loggedIn(
  async ({ query, ctx: { id }, args: { code } }) => {
    const { google_refresh_token } = await query.raw(Mentor).findById(id)
    if (google_refresh_token)
      throw new UserInputError('calendar already connected')

    const client = await getClient()
    const { tokens } = await client.auth.getToken(code)
    const gcal = await getClient(id, tokens.refresh_token)
    const { data } = await gcal.calendar.calendars.insert({
      requestBody: { summary: 'Upframe' },
    })

    await query
      .raw(Mentor)
      .findById(id)
      .patch({
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_calendar_id: data.id,
      })

    return await query().findById(id)
  }
)

export const disconnectCalendar = resolver<User>().loggedIn(
  async ({ query, ctx: { id } }) => {
    const {
      mentors: { google_refresh_token, google_calendar_id, ...mentors } = {},
      ...user
    } = await query({ include: 'mentors' }).findById(id)

    if (!google_refresh_token)
      throw new UserInputError('calendar not connected')

    const gcal = await getClient(id)

    if (google_calendar_id)
      try {
        await gcal.calendar.calendars.delete({
          calendarId: google_calendar_id,
        })
      } catch (e) {
        console.warn("google calendar didn't exist")
      }

    removeClient(id)

    await Promise.all([
      gcal.auth.revokeToken(google_refresh_token),
      query
        .raw(Mentor)
        .findById(id)
        .patch({
          google_refresh_token: null,
          google_access_token: null,
          google_calendar_id: null,
        }),
    ])

    return { ...user, mentors } as User
  }
)
