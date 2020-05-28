import {
  Model,
  QueryBuilder,
  User,
  Mentor,
  SocialMedia,
  Slots,
  ProfilePicture,
  Meetup,
  List,
  Tags,
  Invite,
  ConnectGoogle,
  SigninUpframe,
} from '../models'
import getQueryFields from './queryFields'
import { fromPaths } from '../utils/path'
import _ from 'lodash'
import tracer from '../tracer'

const ENTRIES = {
  Person: User,
  Mentor: User,
  List,
  Tag: Tags,
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
  .add(
    Mentor,
    'company',
    'slots',
    'notificationPrefs',
    'visibility',
    'calendarConnected',
    'calendars'
  )
  .add(SocialMedia, 'social')
  .add(ProfilePicture, 'profilePictures')
  .add(List, 'categories')
  .add(Tags, 'tags')
  .add(Invite, 'invites')
  .add(ConnectGoogle, 'google', 'calendarConnected', 'calendars')
  .add(SigninUpframe, 'google')
set(Mentor).add(Slots, 'slots')
set(Slots).add(Meetup, __ALWAYS__)
set(List).add(User, 'users')
set(Tags).add(User, 'users')

export default Object.assign(
  function<M extends Model>(
    info: any,
    {
      join = false,
      include = {},
      ctx = {},
      section = null,
      entryName = null,
    } = {},
    fields?: Fields
  ): QueryBuilder<M, M[]> {
    let res
    tracer.trace('query.build', () => {
      const type =
        info.returnType.name ?? info.returnType.ofType?.ofType?.ofType?.name
      const entry = ENTRIES[entryName ?? type]
      if (!entry) throw Error(`no known table for ${entryName ?? type}`)

      if (!fields) fields = getQueryFields(info)
      if (section) fields = _.get(fields, section) as Fields

      const resolve = (model: typeof Model, requested: Fields) => {
        const reqKeys = Object.keys(requested)
        let required = Array.from(GQL_SQL_MAP.get(model)?.entries() ?? [])
          .map(([model, fields]) => [
            model,
            fields.filter(
              field => reqKeys.includes(field) || field === __ALWAYS__
            ),
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
                      model.relationMappings[(m as typeof Model).tableName]
                        .relation
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
      graph = mergeGraph(
        graph,
        typeof include === 'string' ? fromPaths(include) : include
      )

      let query = entry.query()
      if (graph) query = query[`withGraph${join ? 'Joined' : 'Fetched'}`](graph)
      res = query.context(ctx)
    })
    return res
  },
  {
    raw: <M extends Model>(
      info: any,
      ctx: ResolverCtx,
      model?: any
    ): QueryBuilder<M, M[]> => {
      let entry
      if (!model) {
        const type =
          info.returnType.name ?? info.returnType.ofType?.ofType?.ofType?.name
        entry = ENTRIES[type]
        if (!entry) throw Error(`no known table for ${type}`)
      } else entry = model
      return entry.query().context(ctx)
    },
  }
)

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
