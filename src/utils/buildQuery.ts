import { QueryBuilder } from 'objection'
import {
  Model,
  User,
  Mentor,
  SocialMedia,
  Slots,
  ProfilePicture,
  Meetup,
  List,
} from '../models'
import getQueryFields from './queryFields'

const ENTRIES = {
  Person: User,
  Mentor: User,
  List,
}
const GQL_SQL_MAP = new Map<typeof Model, Map<typeof Model, string[]>>()
const __ALWAYS__ = '__always__'

const set = (model: typeof Model) => {
  GQL_SQL_MAP.set(model, new Map())
  function add(external: typeof Model, ...fields: string[]) {
    GQL_SQL_MAP.get(model).set(external, fields)
    return { add }
  }
  return { add }
}

set(User)
  .add(Mentor, 'company', 'title', 'slots')
  .add(SocialMedia, 'social')
  .add(ProfilePicture, 'profilePictures')
  .add(List, 'categories')
set(Mentor).add(Slots, 'slots')
set(Slots).add(Meetup, __ALWAYS__)
set(List).add(User, 'users')

type Fields = ReturnType<typeof getQueryFields>

export default function<M extends Model>(
  info: any,
  { join = false, include = {}, id = null } = {}
): QueryBuilder<M, M[]> {
  const type =
    info.returnType.name ?? info.returnType.ofType?.ofType?.ofType?.name
  const entry = ENTRIES[type]
  if (!entry) throw Error(`no known table for ${type}`)
  const fields = getQueryFields(info)

  const resolve = (model: typeof Model, requested: Fields) => {
    const reqKeys = Object.keys(requested)
    let required = Array.from(GQL_SQL_MAP.get(model)?.entries() ?? [])
      .map(([model, fields]) => [
        model,
        fields.filter(field => reqKeys.includes(field) || field === __ALWAYS__),
      ])
      .filter(([, fields]) => fields.length)
      .map(([m, fields]) => [
        m,
        (fields as string[])
          .map(field => [field, requested[field]])
          .map(([f, v]) =>
            typeof v === 'boolean'
              ? { [f as string]: true }
              : [Model.HasOneRelation, Model.BelongsToOneRelation].includes(
                  model.relationMappings[(m as typeof Model).tableName].relation
                )
              ? { [f as string]: v }
              : v
          )
          .reduce((a: Fields, c: Fields) => ({ ...a, ...c }), {}),
      ])

    return {
      [model.tableName]:
        (required.length ? required : undefined)
          ?.map(([model, fields]) =>
            resolve(model as typeof Model, fields as Fields)
          )
          ?.reduce((a, c) => ({ ...a, ...c }), {}) ?? true,
    }
  }

  let { [entry.tableName]: graph } = resolve(entry, fields)
  graph = mergeGraph(graph, include)

  let query = entry.query().context({ id })
  if (graph) query = query[`withGraph${join ? 'Joined' : 'Fetched'}`](graph)
  return query
}

const mergeGraph = (a: object, b: Object) =>
  typeof a === 'object'
    ? {
        ...a,
        ...Object.fromEntries(
          Object.entries(b).map(([k, v]) => [
            k,
            !(k in a) || a[k] === true ? v : mergeGraph(a[k], v),
          ])
        ),
      }
    : b
