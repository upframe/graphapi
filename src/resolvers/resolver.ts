import query from '../utils/buildQuery'
import { ForbiddenError, NotLoggedInError } from '../error'
import { Model, QueryBuilder } from '../models'
import getQueryFields from '../utils/queryFields'

export default function<M = void, P extends Model = null>() {
  type Assertions<M, P> = {
    [key in keyof typeof assertions]: ResolverBuilder<M, P> & Assertions<M, P>
  }

  const asserts = []
  const assertions = {
    loggedIn: {
      get() {
        asserts.push(({ id }) => {
          if (!id) throw NotLoggedInError()
        })
        return this
      },
    },
    isAdmin: {
      get() {
        asserts.push(({ user }) => {
          if (!user.groups.includes('admin'))
            throw new ForbiddenError('you have to be an admin')
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
      const fields = getQueryFields(info)
      return handler({
        query: Object.assign(
          (options = {}) =>
            query(
              info,
              {
                ...options,
                ctx,
              },
              fields
            ),
          {
            raw: (model?: any) => query.raw(info, ctx, model),
          }
        ) as Query<M extends Model ? M : Model>,
        parent,
        args,
        ctx,
        fields,
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
  fields: Fields
}) => Promise<M | M[] | Error> | M | M[] | Error

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
