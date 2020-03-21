import query from '../../utils/buildQuery'
import { User, Mentor } from '../../models'
import { getClient } from '../../gcal'
import { AuthenticationError, UserInputError } from '../../error'

export const connectCalendar = async (_, { code }, { id }, info) => {
  if (!id) throw new AuthenticationError('not logged in')
  const { google_refresh_token } = await Mentor.query()
    .select('google_refresh_token')
    .findById(id)
  if (google_refresh_token)
    throw new UserInputError('must first disconnect connected calendar')

  try {
    const { tokens } = await (await getClient()).auth.getToken(code)

    const client = await getClient(id, tokens.refresh_token)
    const { data } = await client.calendar.calendars.insert({
      requestBody: { summary: 'Upframe' },
    })

    await Mentor.query()
      .findById(id)
      .patch({
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_calendar_id: data.id,
      })
    return await query(info).findById(id)
  } catch (e) {
    console.log(e)
    throw e
  }
}

export const disconnectCalendar = async (_, __, { id }, info) => {
  if (!id) throw new AuthenticationError('not logged in')

  const {
    mentors: { google_refresh_token, google_calendar_id, ...mentors } = {},
    ...user
  } = await query<User>(info).findById(id)

  if (!google_refresh_token) throw new UserInputError('calendar not connected')

  if (google_calendar_id)
    (await getClient(id)).calendar.calendars.delete({
      calendarId: google_calendar_id,
    })

  await Promise.all([
    (await getClient()).auth.revokeToken(google_refresh_token),
    Mentor.query()
      .findById(id)
      .patch({
        google_refresh_token: null,
        google_access_token: null,
        google_calendar_id: null,
      }),
  ])

  return { ...user, mentors }
}
