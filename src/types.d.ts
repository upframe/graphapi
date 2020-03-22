type Resolver<M extends Model = Model> = (args: {
  query: (options?: any) => QueryBuilder<M, M[]>
  parent: any
  args: any
  ctx: any
}) => any

type Fields = { [k: string]: Fields | boolean }
