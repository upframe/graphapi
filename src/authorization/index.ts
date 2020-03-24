import _ from 'lodash'
import * as path from '../utils/path'

export const dataGraph: AccessGraph = {
  users: {
    id: true,
    handle: true,
    name: true,
    email: true,
    password: true,
    role: true,
    location: true,
    biography: true,
    allow_emails: true,
    mentors: true,
  },
  mentors: {
    id: true,
    listed: true,
    title: true,
    company: true,
    google_refresh_token: true,
    google_access_token: true,
    google_calendar_id: true,
    slot_reminder_email: true,
  },
}

const expandPolicy = (policy: any) =>
  path.expand(policy.resource).map(resource => ({ ...policy, resource }))

export const buildPolicies = (policies: any[]) => policies.flatMap(expandPolicy)

export const getPolicies = (entity: Partial<Group>) => [
  ...(entity.groups?.flatMap(getPolicies) ?? []),
  ...(entity.policies ?? []),
]

export function accessFilter(data: any, accessGraph: AccessGraph) {
  const paths = path.getPaths(data)
  const allowed = paths
    .filter(path => _.has(accessGraph, path))
    .map(path => _.pick(data, path))

  return allowed.length ? _.merge(...(allowed as [any])) : {}
}
