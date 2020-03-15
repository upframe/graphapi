import { Model, User, Mentor, SocialMedia, Tags, ProfilePicture, List } from '.'

const ident = (...fields: string[]) =>
  Object.fromEntries(fields.map(v => [v, v]))
const external = (model: typeof Model) => (...fields: string[]) =>
  Object.fromEntries(fields.map(v => [v, model]))

export default new Map<typeof Model, MapInfo>([
  [
    User,
    {
      required: ['id', 'role', 'handle'],
      map: {
        ...ident(
          'id',
          'handle',
          'name',
          'email',
          'password',
          'role',
          'location',
          'website',
          'biography'
        ),
        notificationPrefs: {
          receiveEmails: 'allow_emails',
          slotReminder: Mentor,
        },
        ...external(Mentor)(
          'visibility',
          'title',
          'company',
          'calendarConnected',
          'calendars'
        ),
        ...external(SocialMedia)('social'),
        ...external(Tags)('tags'),
        ...external(ProfilePicture)('profilePictures'),
        ...external(List)('categories'),
      },
    },
  ],
  [
    Mentor,
    {
      required: [
        'id',
        'google_refresh_token',
        'google_access_token',
        'google_calendar_id',
        'score',
      ],
      map: {
        ...ident(
          'id',
          'title',
          'company',
          'google_refresh_token',
          'google_access_token',
          'google_calendar_id'
        ),
        visibility: 'listed',
        notificationPrefs: {
          slotReminder: 'slot_reminder_email',
        },
        calendars: 'google_refresh_token',
      },
    },
  ],
])

interface MapInfo {
  required?: string[]
  map: Mapping
}
export interface Mapping {
  [gql: string]: string | Mapping | typeof Model
}
