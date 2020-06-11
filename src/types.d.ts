type Model = import('./models').Model

type Fields = { [k: string]: Fields | boolean }

interface Policy {
  effect: 'allow' | 'disallow'
  action: Action | string
  resource: string
  where?: WhereFunc | string
}
type Action = 'create' | 'read' | 'update' | 'delete'

type WhereFunc = (
  data: any,
  user: import('./authorization/user').default
) => boolean

interface Group {
  name: string
  policies: Policy[]
  groups: Group[]
}

interface AccessGraph {
  [field: string]: boolean | AccessGraph
}

interface ResolverCtx {
  user: import('./authorization/user').default
  id: string
  roles: string[]
  requestId: string
  clientIp: string
  setHeader(header: string, value: string): void
  knex: import('knex')
}

type ModelContent<M extends Model> = {
  [K in keyof Omit<M, keyof Model>]: M[K] extends Model
    ? ModelContent<M[K]>
    : M[K]
}

// GraphQL types

type Connection<T> = {
  edges: Edge<T>[]
  pageInfo: PageInfo
}

type Edge<T> = {
  cursor: string | number
  node: T
}

type PageInfo = {
  hasNextPage: boolean
  hasPreviousPage: boolean
}
