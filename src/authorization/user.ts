import { buildPolicies, getPolicies } from '.'
import * as groupList from './groups'
import { getPaths } from '../utils/path'
import _ from 'lodash'

export default class AuthUser {
  private _groups: string[] = []
  private _policies: Policy[] = []
  private _expanded: Policy[] = []
  public denied: string[] = []

  constructor(public readonly id: string) {}

  get policies() {
    return this._policies
  }
  set policies(v: Policy[]) {
    this._policies = v
    this._expandPolicies()
  }
  get groups() {
    return this._groups
  }
  set groups(v: string[]) {
    this._groups = v
    this._expandPolicies()
  }
  get expandedPolicies() {
    return this._expanded
  }

  private _expandPolicies() {
    this._expanded = buildPolicies(
      getPolicies({
        policies: this._policies,
        groups: this._groups.map(v => groupList[v]),
      })
    )
  }

  private checkPolicy(
    policy: Policy,
    resource: string,
    action: Action,
    data?: any
  ): PolicyEffect {
    if (policy.action !== action) return PolicyEffect.NO_EFFECT

    if (
      typeof policy.where === 'function' &&
      'where' in policy && (!data || !policy.where(data, this))
    )
      return PolicyEffect.NO_EFFECT

    const policyPath = policy.resource.split('.')
    const resourcePath = resource.split('.')

    let effect = PolicyEffect.NO_EFFECT
    Array(Math.max(policyPath.length, resourcePath.length))
      .fill(0)
      .map((_, i) => [policyPath[i], resourcePath[i]])
      .some(([policySeg, resourceSeg], i) => {
        if (policySeg !== resourceSeg) {
          effect = PolicyEffect.NO_EFFECT
          return true
        }
        if (policySeg === resourceSeg && i === policyPath.length - 1) {
          if (policy.effect === 'allow') effect = PolicyEffect.ALLOW
          else effect = PolicyEffect.DISALLOW
          return true
        }
      })
    return effect
  }

  can(resource: string, action: Action, data?: any): boolean {
    let effect: PolicyEffect = PolicyEffect.NO_EFFECT
    for (const policy of this.expandedPolicies) {
      const res = this.checkPolicy(policy, resource, action, data)
      if (res !== PolicyEffect.NO_EFFECT) effect = res
    }
    return effect === PolicyEffect.ALLOW
  }

  filter(data: any) {
    const [permitted, denied] = _.partition(getPaths(data), path =>
      this.can(path, 'read', data)
    )
    this.denied.push(...denied)
    return _.pick(data, ...permitted)
  }
}

enum PolicyEffect {
  DISALLOW = -1,
  NO_EFFECT = 0,
  ALLOW = 1,
}
