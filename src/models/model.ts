import { Model as ObjectionModel } from 'objection'

export class Model extends ObjectionModel {
  static _controlAccess(item: Model, context: ResolverCtx) {
    const data = { [this.tableName]: item }
    const relations = Object.fromEntries(
      Object.entries(item)
        .filter(([k]) => k in (this.relationMappings ?? {}))
        .map(([k, result]) => {
          const relation = (this.relationMappings ?? {})[k]?.modelClass
          return [k, relation?.afterFind({ result, context }) ?? result]
        })
    )

    return { ...context.user.filter(data)[this.tableName], ...relations }
  }

  static afterFind({ result, context, relation }: any) {
    if (relation || !result || !context.user) return
    return Array.isArray(result)
      ? result.map(v => this._controlAccess(v, context))
      : this._controlAccess(result, context)
  }
}
