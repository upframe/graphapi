type Model = import('./models').Model

type Resolver<M extends Model = Model> = (args: {
  query: ((options?: any) => import('objection').QueryBuilder<M, M[]>) & {
    raw<R extends Model = M>(
      model?: new () => R
    ): import('objection').QueryBuilder<R, R[]>
  }
  parent: any
  args: any
  ctx: any
}) => any

type Fields = { [k: string]: Fields | boolean }

interface Policy {
  effect: 'allow' | 'disallow'
  action: Action
  resource: string
  where?: WhereFunc | string
}
type Action = 'read' | 'create' | 'delete'

type WhereFunc = (
  data: any,
  user: import('./authorization/user').default
) => boolean

interface Group {
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
  setHeader(header: string, value: string): void
}
