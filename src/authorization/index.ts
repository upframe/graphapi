import _ from 'lodash'
import * as path from '../utils/path'
import * as groupList from './groups'
import { ForbiddenError } from 'apollo-server-lambda'

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

const buildPolicies = (policies: any[]) => policies.flatMap(expandPolicy)

const getPolicies = (entity: Partial<Group | User>) => [
  ...(entity.groups?.flatMap(getPolicies) ?? []),
  ...(entity.policies ?? []),
]

export const buildAccessGraph = (user: Partial<User>): AccessGraph => {
  const policies = buildPolicies(getPolicies(user))
  let accessGraph = {}
  for (const policy of policies) {
    if (policy.effect === 'allow')
      accessGraph = _.merge(accessGraph, _.pick(dataGraph, policy.resource))
    else if (policy.effect === 'disallow')
      accessGraph = _.omit(accessGraph, policy.resource)
    else throw Error(`invalid policy effect ${policy.effect}`)
  }
  return accessGraph
}

export const buildUser = (id: string, ...groupNames: string[]): User => {
  if (groupNames.length === 0) groupNames = ['visitor']
  const groups = groupNames.map(group => {
    if (!(group in groupList))
      throw new ForbiddenError(`invalid group ${group}`)
    return groupList[group]
  })
  return {
    id,
    groups,
    policies: [],
    accessGraph: buildAccessGraph({ id, groups }),
  }
}

export function accessFilter(data: any, accessGraph: AccessGraph) {
  const paths = path.getPaths(data)
  const allowed = paths
    .filter(path => _.has(accessGraph, path))
    .map(path => _.pick(data, path))

  return allowed.length ? _.merge(...(allowed as [any])) : {}
}
