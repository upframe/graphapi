import { Model as ObjectionModel } from 'objection'
import { accessFilter, dataGraph } from '../authorization'

export class Model extends ObjectionModel {
  static _controlAccess(item: Model, context: Partial<User> = {}) {
    const data = { [this.tableName]: item }
    const relations = Object.fromEntries(
      Object.entries(item)
        .filter(([k]) => k in (this.relationMappings ?? {}))
        .map(([k, result]) => {
          const relation = (this.relationMappings ?? {})[k]?.modelClass
          return [k, relation?.afterFind({ result, context }) ?? result]
        })
    )
    const filtered =
      this.tableName in dataGraph
        ? accessFilter(data, context.accessGraph)
        : data
    return { ...filtered[this.tableName], ...relations }
  }

  static afterFind({ result, context, relation }: any) {
    if (relation || !result) return
    return Array.isArray(result)
      ? result.map(v => this._controlAccess(v, context))
      : this._controlAccess(result, context)
  }
}
