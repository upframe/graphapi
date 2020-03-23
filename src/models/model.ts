import { Model as ObjectionModel } from 'objection'
import { buildAccessGraph, accessFilter, dataGraph } from '../authorization'
import { Maker } from '../authorization/roles'

export class Model extends ObjectionModel {
  static _controlAccess(item: Model, id: string) {
    const data = { [this.tableName]: item }
    const relations = Object.fromEntries(
      Object.entries(item)
        .filter(([k]) => k in (this.relationMappings ?? {}))
        .map(([k, result]) => {
          const relation = (this.relationMappings ?? {})[k]?.modelClass
          return [k, relation?.afterFind({ result }) ?? result]
        })
    )
    const filtered =
      this.tableName in dataGraph
        ? accessFilter(data, buildAccessGraph(Maker))
        : data
    return { ...filtered[this.tableName], ...relations }
  }

  static afterFind({ result, context, relation }: any) {
    if (relation || !result) return
    return Array.isArray(result)
      ? result.map(v => this._controlAccess(v, context?.id))
      : this._controlAccess(result, context?.id)
  }
}
