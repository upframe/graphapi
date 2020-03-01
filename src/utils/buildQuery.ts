import { Model } from 'objection'
import getQueryFields from './queryFields'
import gqlSqlMap, { Mapping } from '../models/gqlMap'
import merge from 'lodash/merge'

interface Fields {
  [field: string]: boolean | Fields
}

const resolveColumns = (
  model: typeof Model,
  fields: Fields,
  additional: string[] = []
): { columns: string[]; tables: string[] } => {
  const { map, required = [] } = gqlSqlMap.get(model) ?? {}
  let tables = [model.tableName]
  if (!map) return { columns: [], tables }

  fields = {
    ...fields,
    ...Object.fromEntries([...required, ...additional].map(k => [k, true])),
  }

  const resolveFields = (
    map: Mapping,
    field: string | string[] = typeof fields === 'string'
      ? fields
      : Object.keys(fields)
  ) => {
    if (Array.isArray(field))
      return field.flatMap(field => resolveFields(map, field))
    if (!(field in map)) return []
    if (typeof map[field] === 'function') {
      let res = resolveColumns(map[field] as typeof Model, { [field]: true })
      tables = Array.from(new Set([...tables, ...res.tables]))
      return res.columns
    }

    if (typeof map[field] === 'string')
      return `${model.tableName}.${map[field]}${
        map[field] !== field ? ` as ${field}` : ''
      }`
    return Object.keys(map[field]).map(child =>
      resolveFields(map[field] as Mapping, child)
    )
  }

  return { columns: Array.from(new Set(resolveFields(map))), tables }
}

export function buildQuery(
  model: typeof Model,
  fields: Fields,
  additional: string[] = []
): ReturnType<typeof Model.query> {
  const { columns, tables } = resolveColumns(model, fields, additional)
  let query = model.query().select(columns)
  tables
    .filter(table => table !== model.tableName)
    .forEach(table => {
      query = query.withGraphJoined(table)
    })
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
