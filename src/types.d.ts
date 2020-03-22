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
}

interface AccessGraph {
  [field: string]: boolean | AccessGraph
}
