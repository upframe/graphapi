import token from '~/utils/token'
import { ddb } from '~/utils/aws'

type Payload = { editor: string; [k: string]: string | number | boolean }

async function logEvent(trailId: string, event: Payload) {
  event.time = Date.now()
  event.trail_id = trailId
  event.event_id = `${(event.time / 1000) | 0}_${token()}`

  await ddb.put({ TableName: 'audit_trail', Item: event }).promise()
}

type SpaceEvent =
  | 'create_space'
  | 'add_user'
  | 'change_member_role'
  | 'upload_space_photo'
  | 'upload_cover_photo'
  | 'remove_member'
  | 'join_space'
  | 'create_invite_link'
  | 'revoke_invite_link'
  | 'change_space_info'

async function space(id: string, eventType: SpaceEvent, payload: Payload) {
  await logEvent(`SPACE|${id}`, { ...payload, eventType, space: id })
}

export default Object.assign(logEvent, { space })
