import { Model } from 'objection'
import { User } from '.'

export default new Map<typeof Model, MapInfo>([
  [
    User,
    {
      required: ['uid', 'type'],
      map: {
        name: 'name',
        email: 'email',
        keycode: 'keycode',
        location: 'location',
        website: 'website',
        bio: 'bio',
        tags: 'tags',
        visibility: 'newsfeed',
        profilePictures: 'profilePic',
        social: {
          dribbble: 'dribbble',
          facebook: 'facebook',
          github: 'github',
          linkedin: 'linkedin',
          twitter: 'twitter',
        },
        notificationPrefs: {
          receiveEmails: 'emailNotifications',
          slotReminder: 'availabilityReminder',
        },
      },
      relations: {
        profilePictures: 'profilePictures',
        slots: 'timeSlots',
      },
    },
  ],
])

interface MapInfo {
  required?: string[]
  map: Mapping
  relations?: Relations
}
export interface Mapping {
  [gql: string]: string | Mapping
}
export interface Relations {
  [gql: string]: string
}
