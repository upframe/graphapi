import query from '../utils/buildQuery'
import { AuthenticationError } from '../error'
import { Model, QueryBuilder } from '../models'

export default function<M = void>() {
  type Assertions<M> = {
    [key in keyof typeof assertions]: ResolverBuilder<M> & Assertions<M>
  }

  const asserts = []
  const assertions = {
    loggedIn: {
      get() {
        asserts.push(({ id }) => {
          if (!id) throw new AuthenticationError('not logged in')
        })
        return this
      },
    },
  }

  return Object.defineProperties(
    (handler: Resolver<M>) => (
      ...[parent, args, ctx, info]: Parameters<ApolloResolver>
    ) => {
      asserts.forEach(assert => assert(ctx))
      return handler({
        query: Object.assign(
          (options = {}) =>
            query(info, {
              ...options,
              ctx,
            }),
          {
            raw: (model?: any) => query.raw(info, ctx, model),
          }
        ) as Query<M extends Model ? M : Model>,
        parent,
        args,
        ctx,
      })
    },
    assertions
  ) as ResolverBuilder<M> & Assertions<M>
}

type Resolver<M = void> = (args: {
  query: Query<M extends Model ? M : Model>
  parent: any
  args: any
  ctx: ResolverCtx
}) => Promise<M | M[]> | M | M[]

type Query<M extends Model> = ((
  options?: any
) => QueryBuilder<
  M extends Model ? M : Model,
  M extends Model ? M[] : Model[]
>) & {
  raw<R extends Model = M>(model?: new () => R): QueryBuilder<R, R[]>
}

type ApolloResolver = (parent: any, args: any, ctx: any, info: any) => any
type ResolverBuilder<M = void> = (
  handler: Resolver<M>
) => (...args: Parameters<ApolloResolver>) => any
