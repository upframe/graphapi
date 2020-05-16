import resolver from '../resolver'
import { SocialMedia, User } from '../../models'
import { createClient } from '../../google'
import { google as gapi } from 'googleapis'

export const __resolveType = resolver<string, any>()(({ parent: { role } }) => {
  if (role !== 'user') return 'Mentor'
  return 'User'
})

export const social = resolver<any[], User>()(
  async ({ parent: { socialmedia = [] }, args: { includeEmpty } }) => {
    if (includeEmpty)
      return (await SocialMedia.query()).map(v => ({
        ...v,
        ...socialmedia.find(({ id }) => id === v.id),
      }))
    return socialmedia
  }
)

export const tags = resolver<any[], User>()(({ parent: { role, tags = [] } }) =>
  role === 'user' ? null : tags
)

export const notificationPrefs = resolver<any, User>()(
  ({ parent: { allow_emails, ...parent } }) => ({
    receiveEmails: allow_emails,
    ...parent,
  })
)

export const profilePictures = resolver<any[], User>()(
  ({ parent: { profile_pictures } }) =>
    profile_pictures?.length
      ? profile_pictures
      : [
          {
            url: process.env.BUCKET_URL + 'default.png',
          },
        ]
)

export const categories = resolver<
  any[],
  User
>()(({ parent: { lists = [] } }) => lists.map(({ name }) => name))

export const role = resolver<string, User>()(({ parent: { role } }) =>
  role.toUpperCase()
)

export const invites = resolver<any[], User>()(({ parent: { invites } }) =>
  (invites ?? []).map(invite => ({
    ...invite,
    status: invite.redeemed ? 'JOINED' : 'PENDING',
    role: invite.role.toUpperCase(),
  }))
)

export const google = resolver<any, User>()(
  async ({ parent: { connect_google, signin_upframe } }) => {
    try {
      if (!connect_google?.refresh_token) return { connected: false }
      const client = createClient()
      client.setCredentials(connect_google)
      const { data } = await gapi
        .oauth2({ auth: client, version: 'v2' })
        .userinfo.get()
      return { connected: true, canDisconnect: !!signin_upframe, ...data }
    } catch (e) {
      return { connected: false }
    }
  }
)
