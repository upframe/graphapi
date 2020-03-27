type Model = import('./models').Model

type Fields = { [k: string]: Fields | boolean }

interface Policy {
  effect: 'allow' | 'disallow'
  action: Action
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
  setHeader(header: string, value: string): void
}

type ModelContent<M extends Model> = Omit<M, keyof Model>
