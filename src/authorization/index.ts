import _ from 'lodash'
import * as path from '../utils/path'

function buildWhere(where: string): WhereFunc {
  const [ls, op, rs] = where.split(/(!?=)/).map(v => v.trim())
  if (!ls || !rs) throw Error(`invalid where expression ${where}`)
  const ops = {
    '=': (ls, rs) => ls === rs,
    '!=': (ls, rs) => ls !== rs,
  }
  if (!(op in ops))
    throw Error(`invalid operator ${op} in where expression ${where}`)
  return (data, user) =>
    ops[op](
      _.get(data, ls) as any,
      /^current\.[\w\d.]+$/.test(rs)
        ? _.get(user, rs.replace(/^current\.(.+)/, '$1'))
        : JSON.parse(rs)
    )
}

const expandPolicy = (policy: any) =>
  path.expand(policy.resource).map(resource => ({
    ...policy,
    resource,
    ...('where' in policy && {
      where:
        typeof policy.where === 'function'
          ? policy.where
          : buildWhere(policy.where),
    }),
  }))

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
