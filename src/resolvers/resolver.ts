import query from '../utils/buildQuery'
import { AuthenticationError } from '../error'
import { Model, QueryBuilder } from '../models'

export default function<M = void, P extends Model = null>() {
  type Assertions<M, P> = {
    [key in keyof typeof assertions]: ResolverBuilder<M, P> & Assertions<M, P>
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
    (handler: Resolver<M, P>) => (
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
  ) as ResolverBuilder<M, P extends Model ? ModelContent<P> : P> &
    Assertions<M, P extends Model ? ModelContent<P> : P>
}

type Resolver<M = void, P = null> = (args: {
  query: Query<M extends Model ? M : Model>
  parent: P
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
type ResolverBuilder<M = void, P = null> = (
  handler: Resolver<M, P>
) => (...args: Parameters<ApolloResolver>) => any
