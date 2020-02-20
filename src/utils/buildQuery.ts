import { Model } from 'objection'
import getQueryFields from './queryFields'
import gqlSqlMap, { Mapping, Relations } from '../models/gqlMap'
import merge from 'lodash/merge'

interface Fields {
  [field: string]: boolean | Fields
}
const resolveColumns = (model: Mapping, fields: Fields) =>
  typeof model === 'string'
    ? model
    : Object.entries(fields).flatMap(([k, v]) =>
        !(k in model)
          ? []
          : typeof v === 'boolean'
          ? model[k]
          : resolveColumns(model[k] as Mapping, v)
      )
const resolveRelations = (relations: Relations, fields: Fields) =>
  Object.keys(fields).flatMap(field => relations[field] ?? [])

export function buildQuery(
  model: typeof Model,
  fields: Fields,
  additional: string[] = []
): ReturnType<typeof Model.query> {
  const { map, relations, required } = gqlSqlMap.get(model)
  const columns = fields ? resolveColumns(map, fields) : []
  const graphs = fields && relations ? resolveRelations(relations, fields) : []
  let query = model
    .query()
    .select([...(required ?? []), ...columns, ...additional])
  for (let graph of graphs) query = query.withGraphFetched(graph)
  return query
}

export default (
  model: typeof Model,
  info: any,
  ...additional: (string | string[])[]
) => buildQuery(model, info ? getQueryFields(info) : null, additional.flat())

export const querySubset = (
  model: typeof Model,
  field: string,
  info: any,
  ...additional: (string | string[])[]
) =>
  buildQuery(
    model,
    info ? getQueryFields(info)[field] : null,
    additional.flat()
  )

export const querySubsets = (
  model: typeof Model,
  fields: string[],
  info: any,
  ...additional: (string | string[])[]
) => {
  const req = getQueryFields(info)
  return buildQuery(
    model,
    !info ? null : merge({}, ...fields.map(field => req[field])),
    additional.flat()
  )
}
