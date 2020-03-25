import { Model as ObjectionModel } from 'objection'
import { ForbiddenError } from '../error'

type StaticHookArguments = Parameters<typeof ObjectionModel.beforeInsert>[0] & {
  context: ResolverCtx
  cancelQuery(): void
}

export class Model extends ObjectionModel {
  static _controlAccess(item: Model, context: ResolverCtx) {
    const data = { [this.tableName]: item }
    const filtered = context.user.filter(data)[this.tableName]
    const relations = Object.fromEntries(
      Object.entries(item)
        .filter(([k]) => k in (this.relationMappings ?? {}) && k in filtered)
        .map(([k, result]) => {
          const relation = (this.relationMappings ?? {})[k]?.modelClass
          return [k, relation?.afterFind({ result, context }) ?? result]
        })
    )
    return { ...filtered, ...relations }
  }

  static afterFind({ result, context, relation }: StaticHookArguments) {
    if (relation || !result || !context.user) return
    return Array.isArray(result)
      ? result.map(v => this._controlAccess(v, context))
      : this._controlAccess(result, context)
  }

  static beforeInsert({ context }: StaticHookArguments) {
    if (!context?.user?.can(this.tableName, 'create'))
      throw new ForbiddenError(
        `you are not allowed to create ${this.tableName}`
      )
  }
}
