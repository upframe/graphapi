import resolver from '../resolver'
import { SocialMedia, User, Tags, Space } from '~/models'
import { createClient } from '~/google'
import { google as gapi } from 'googleapis'
import Conversation from '~/messaging/conversation'
import { msgToken as createMsgToken } from '~/auth'
import * as db from '~/messaging/db'

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

export const tags = resolver<
  any,
  User
>()(async ({ query, knex, parent: { id, role, tags = [] } }) =>
  role === 'user'
    ? null
    : tags ??
      (await query
        .raw(Tags)
        .whereIn('id', knex('user_tags').where({ user_id: id })))
)

export const notificationPrefs = resolver<any, User>()(
  ({ parent: { allow_emails, msg_emails, ...parent } }) => ({
    receiveEmails: allow_emails,
    msgEmails: msg_emails,
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

export const role = resolver<string, User>()(
  ({ parent: { role }, ctx: { roles } }) => {
    if (role === 'admin' && !roles.includes('admin')) role = 'mentor'
    return role.toUpperCase()
  }
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

export const timezone = resolver<any, User>()(({ parent }) =>
  parent.timezone ? parent : null
)

export const inferTz = resolver<boolean, User>()(
  ({ parent }) => parent.tz_infer
)

export const conversations = resolver<
  any,
  User
>()(async ({ parent: { id }, ctx }) =>
  id === ctx.id ? await Conversation.getUserConversations(id) : null
)

export const msgToken = resolver<string, User>()(({ parent, ctx: { id } }) => {
  return id === parent.id ? createMsgToken(parent as User) : null
})

export const unread = resolver<any, User>()(async ({ parent, ctx: { id } }) => {
  if (parent.id !== id) return null
  const user = await db.getUser(parent.id)
  return Object.entries(user)
    .filter(([k]) => k.startsWith('unread_'))
    .map(([k, v]) => ({ channelId: k.replace(/^unread_/, ''), unread: v }))
})

export const displayName = resolver<string, User>()(
  ({ parent }) => parent.display_name ?? parent.name.split(/[\s_.]/)[0]
)

export const sortScore = resolver<number, any>()(({ parent }) => parent.rank)

export const joined = resolver<string, User>()(({ parent }) =>
  new Date(parent.joined).toISOString()
)

export const spaces = resolver<Space[], User>()(({ parent, ctx: { user } }) =>
  user.id === parent.id || user.groups.includes('admin') ? parent.spaces : null
)
