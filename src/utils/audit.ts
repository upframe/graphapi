import token from '~/utils/token'
import { ddb } from '~/utils/aws'

type Payload = { editor: string; [k: string]: string | number }

async function logEvent(trailId: string, event: Payload) {
  event.time = Date.now()
  event.trail_id = trailId
  event.event_id = `${(event.time / 1000) | 0}_${token()}`

  await ddb.put({ TableName: 'audit_trail', Item: event }).promise()
}

type SpaceEvent = 'create_space' | 'add_user' | 'remove_user'

async function space(id: string, eventType: SpaceEvent, payload: Payload) {
  await logEvent(`SPACE|${id}`, { ...payload, eventType })
}

export default Object.assign(logEvent, { space })
