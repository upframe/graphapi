import {
  Model as ObjectionModel,
  QueryBuilder as ObjectionQueryBuilder,
  Page,
} from 'objection'
import { ForbiddenError } from '../error'
import knex from '../db'
import AuthUser from 'src/authorization/user'

const debug: boolean = (knex as any).context?.client?.config?.debug

export class QueryBuilder<
  M extends ObjectionModel,
  R = M[]
> extends ObjectionQueryBuilder<M, R> {
  ArrayQueryBuilderType!: QueryBuilder<M, M[]>
  SingleQueryBuilderType!: QueryBuilder<M, M>
  NumberQueryBuilderType!: QueryBuilder<M, number>
  PageQueryBuilderType!: QueryBuilder<M, Page<M>>

  asUser(user: AuthUser) {
    this.context({ ...this.context(), user })
    return this
  }
}

type StaticHookArguments = Parameters<typeof ObjectionModel.beforeInsert>[0] & {
  context: ResolverCtx
  cancelQuery(): void
}

export class Model extends ObjectionModel {
  QueryBuilderType!: QueryBuilder<this>
  static QueryBuilder = QueryBuilder

  static afterFind({ result, context, relation }: StaticHookArguments) {
    if (relation || !result || !context.user) return
    this._log('afterFind')
    return Array.isArray(result)
      ? result.map(v => this._controlAccess(v, context))
      : this._controlAccess(result, context)
  }

  static beforeInsert({ context }: StaticHookArguments) {
    this._log('beforeInsert')
    if (!context?.user?.can(this.tableName, 'create'))
      throw new ForbiddenError(
        `you are not allowed to create ${this.tableName}`
      )
  }

  static beforeUpdate({ context, inputItems }: StaticHookArguments) {
    this._log('beforeUpdate')
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
    this._log('beforeDelete')
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

  private static _log(action: string) {
    if (debug) console.log(`${this.tableName}.${action}`)
  }
}
