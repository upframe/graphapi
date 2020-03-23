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
}

interface Group {
  policies: Policy[]
  groups: Group[]
}
interface User extends Group {
  id: string
  accessGraph: AccessGraph
}

interface AccessGraph {
  [field: string]: boolean | AccessGraph
}

interface ResolverCtx {
  id: string
  roles: string[]
  accessGraph: AccessGraph
  setHeader(header: string, value: string): void
}
