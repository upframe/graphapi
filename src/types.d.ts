type Resolver<M extends Model = Model> = (args: {
  query: (options?: any) => QueryBuilder<M, M[]>
  parent: any
  args: any
  ctx: any
}) => any

type Fields = { [k: string]: Fields | boolean }

interface Policy {
  effect: 'allow' | 'disallow'
  action: 'read'
  resource: string
  where?: WhereFunc | string
}

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
