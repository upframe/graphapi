import {
  Model as ObjectionModel,
  QueryBuilder as ObjectionQueryBuilder,
  Page,
} from 'objection'
import { ForbiddenError } from '../error'
import AuthUser from 'src/authorization/user'
import _ from 'lodash'
import columnInfo from '../../db/meta/columns.json'

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

  findById(id) {
    this.context({
      ...this.context(),
      byId: { [(this as any)._modelClass?.tableName]: id },
    })
    return super.findById(id)
  }

  patchAndFetchById(id, patch) {
    this.context({
      ...this.context(),
      byId: { [(this as any)._modelClass?.tableName]: id },
    })
    return super.patchAndFetchById(id, patch)
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

    return Array.isArray(result)
      ? result.map(v => this._controlAccess(v, context))
      : this._controlAccess(result, context)
  }

  static beforeInsert({ context, inputItems }: StaticHookArguments) {
    if (
      !inputItems.every(item =>
        context?.user?.can(this.tableName, 'create', {
          [this.tableName]: item,
        })
      )
    )
      throw new ForbiddenError(
        `you are not allowed to create ${this.tableName}`
      )
  }

  static beforeUpdate({ context, inputItems }: StaticHookArguments) {
    let id = _.get(context, `byId.${this.tableName}`)
    if (typeof this.idColumn === 'string') id = { [this.idColumn]: id }
    else if (Array.isArray(this.idColumn))
      id = Object.fromEntries(this.idColumn.map((c, i) => [c, id[i]]))
    if (
      !inputItems.every(item =>
        context?.user?.can(this.tableName, 'update', {
          [this.tableName]: {
            ...item,
            ...Object.fromEntries(
              Object.entries(id)
                .map(([c, v]) => [c, item[c] ?? v])
                .filter(([, v]) => v !== undefined)
            ),
          },
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

  static _controlAccess(item: Model, context: ResolverCtx) {
    const data = { [this.tableName]: item }
    const filtered = context.user.filter(data)[this.tableName]
    const relations = Object.fromEntries(
      Object.entries(item)
        .filter(([k]) => k in (this.relationMappings ?? {}) && k in filtered)
        .map(([k, result]) => {
          const relation = (this.relationMappings ?? {})[k]?.modelClass
          return [k, relation?.afterFind({ result, context }, false) ?? result]
        })
    )
    const result = { ...filtered, ...relations }
    Object.setPrototypeOf(result, this.prototype)
    return result
  }

  static tableMetadata({ table }) {
    if (!(table in columnInfo))
      throw new Error(`metadata for table ${table} not available`)
    return columnInfo[table]
  }
}
