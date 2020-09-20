import resolver from '../resolver'
import token from '~/utils/token'
import { ddb } from '~/utils/aws'
import { User } from '~/models'

async function logEvent(trailId: string, event: any) {
  event.time = Date.now()
  event.trail_id = trailId
  event.event_id = `${(event.time / 1000) | 0}_${token()}`

  await ddb.put({ TableName: 'audit_trail', Item: event }).promise()
}

export const editUserInfo = resolver().isAdmin(
  async ({ args: { userId, info }, query, ctx: { id: editor } }) => {
    const user = await query.raw(User).findById(userId)

    await Promise.all(
      Object.entries(info).map(([field, v]) =>
        logEvent('admin_edits', {
          editor,
          eventType: 'edit_user_info',
          field,
          old: user[field],
          new: v,
        })
      )
    )

    await query.raw(User).upsertGraph({ id: userId, ...info })
  }
)
