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
    const result = { ...filtered, ...relations }
    Object.setPrototypeOf(result, this.prototype)
    return result
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

  static beforeUpdate({ context, inputItems }: StaticHookArguments) {
    if (
      !inputItems.every(item =>
        context?.user?.can(this.tableName, 'update', {
          [this.tableName]: item,
        })
      )
    )
      throw new ForbiddenError(
        `you are not allowed to update ${this.tableName}`
      )
  }

  static async beforeDelete({ context, asFindQuery }: StaticHookArguments) {
    const items = await asFindQuery()
    if (
      !items.every(item =>
        context?.user?.can(this.tableName, 'delete', {
          [this.tableName]: item,
        })
      )
    )
      throw new ForbiddenError(
        `you are not allowed to delete ${this.tableName}`
      )
  }
}
