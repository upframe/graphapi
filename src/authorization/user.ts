import { buildPolicies, getPolicies } from '.'
import * as groupList from './groups'
import { getPaths } from '../utils/path'
import _ from 'lodash'

export default class AuthUser {
  id: string
  private _groups: string[] = []
  private _policies: Policy[] = []
  private _expanded: Policy[] = []

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

  _expandPolicies() {
    this._expanded = buildPolicies(
      getPolicies({
        policies: this._policies,
        groups: this._groups.map(v => groupList[v]),
      })
    )
  }

  private static checkPolicy(policy, resource): PolicyEffect {
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

  can(resource: string): boolean {
    let effect: PolicyEffect = PolicyEffect.NO_EFFECT
    for (const policy of this.expandedPolicies) {
      const res = AuthUser.checkPolicy(policy, resource)
      if (res !== PolicyEffect.NO_EFFECT) effect = res
    }
    return effect === PolicyEffect.ALLOW
  }

  filter(data: any) {
    return _.pick(data, ...getPaths(data).filter(path => this.can(path)))
  }
}

enum PolicyEffect {
  DISALLOW = -1,
  NO_EFFECT = 0,
  ALLOW = 1,
}