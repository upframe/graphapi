import { ddb } from '~/utils/aws'
import { batch } from '~/utils/array'

export type tables = {
  conversations: {
    pk: string
    sk: string
  }
  connections: {
    pk: string
    sk: string
  }
}
type Item<T extends keyof tables> = { key: tables[T] } & { [k: string]: any }

export const format = (data: any) =>
  data &&
  Object.fromEntries(
    Object.entries(data).map(([k, v]: [string, any]) => [
      k,
      v?.wrapperName === 'Set' ? v.values : v,
    ])
  )

export const get = async <T extends keyof tables>(table: T, key: tables[T]) => {
  const { Item } = await ddb.get({ TableName: table, Key: key }).promise()
  return Item ? format(Item) : null
}

type Condition = 'NOT_EXISTS'
export const put = async <T extends keyof tables>(
  table: T,
  { key, ...rest }: Item<T>,
  cond?: Condition
) => {
  await ddb
    .put({
      TableName: table,
      Item: { ...key, ...rest },
      ...(cond === 'NOT_EXISTS' && {
        ConditionExpression: Object.keys(key)
          .map(k => `${k} <> :${k}`)
          .join(' AND '),
        ExpressionAttributeValues: Object.fromEntries(
          Object.entries(key).map(([k, v]) => [`:${k}`, v])
        ),
      }),
    })
    .promise()
}

export const batchRead = async <T extends keyof tables>(
  table: T,
  keys: tables[T][]
) => {
  const { Responses } = await ddb
    .batchGet({ RequestItems: { [table]: { Keys: keys } } })
    .promise()

  return Responses?.[table]?.map(format)
}

export const batchRequest = async <T extends keyof tables>(
  table: T,
  { add = [], remove = [] }: { add?: Item<T>[]; remove?: tables[T][] }
) => {
  const items = [
    ...add
      .map(({ key, ...rest }) => ({ ...key, ...rest }))
      .map(Item => ({ PutRequest: { Item } })),
    ...remove.map(Key => ({ DeleteRequest: { Key } })),
  ]
  const batches = batch(items, 25)

  await Promise.all(
    batches.map(batch =>
      ddb
        .batchWrite({
          RequestItems: {
            [table]: batch,
          },
        })
        .promise()
    )
  )
}

export const batchWrite = async <T extends keyof tables>(
  table: T,
  items: Item<T>[]
) => await batchRequest(table, { add: items })

export const batchDelete = async <T extends keyof tables>(
  table: T,
  keys: tables[T][]
) => await batchRequest(table, { remove: keys })

type QueryCondition<T extends keyof tables, K extends Field<T> = Field<T>> = [
  K,
  Connection,
  Value<T, K>
]
type Field<T extends keyof tables> = keyof tables[T]
type Connection = '=' | 'begins'
type Value<T extends keyof tables, K extends Field<T>> = tables[T][K]

export const query = async <T extends keyof tables>(
  table: T,
  ...conditions: QueryCondition<T>[]
) => {
  const buildCondition = ([field, comp]: QueryCondition<T>): string => {
    const comps: { [k in Connection]: (f: typeof field) => string } = {
      '=': f => `${f} = :${f}`,
      begins: f => `begins_with(${f}, :${f})`,
    }
    return comps[comp](field)
  }

  const KeyConditionExpression = conditions
    .map(cond => buildCondition(cond))
    .join(' AND ')

  const ExpressionAttributeValues = Object.fromEntries(
    conditions.map(([f, , v]) => [`:${f}`, v])
  )

  const { Items } = await ddb
    .query({
      TableName: table,
      KeyConditionExpression,
      ExpressionAttributeValues,
    })
    .promise()

  return Items.map(format)
}

export const remove = async <T extends keyof tables>(
  table: T,
  key: tables[T],
  returnValue = false
) => {
  const { Attributes } = await ddb
    .delete({
      TableName: table,
      Key: key,
      ReturnValues: returnValue ? 'ALL_OLD' : 'NONE',
    })
    .promise()
  return Attributes && format(Attributes)
}

type UpdateExpr = [UpdateVerb, string, any]
type UpdateVerb = 'ADD' | 'DELETE' | 'SET' | 'REMOVE'

export const update = async <T extends keyof tables>(
  table: T,
  key: tables[T],
  exprs: UpdateExpr[],
  returnValue = false,
  cond?: 'EXISTS'
) => {
  const UpdateExpression = exprs
    .map(
      ([verb, field]) =>
        `${verb} #${field} ${
          ['SET', 'REMOVE'].includes(verb) ? '= ' : ''
        }:${field}`
    )
    .join(', ')
  const ExpressionAttributeValues = Object.fromEntries(
    exprs.map(([verb, field, value]) => [
      `:${field}`,
      ['SET', 'REMOVE'].includes(verb)
        ? value
        : ddb.createSet(Array.isArray(value) ? value : [value]),
    ])
  )

  const ExpressionAttributeNames = Object.fromEntries(
    exprs.map(([, field]) => [`#${field}`, field])
  )

  const { Attributes } = await ddb
    .update({
      TableName: table,
      Key: key,
      UpdateExpression,
      ExpressionAttributeValues,
      ReturnValues: returnValue ? 'ALL_NEW' : 'NONE',
      ...(cond === 'EXISTS' && {
        ConditionExpression: Object.keys(key)
          .map(k => `attribute_exists(${k})`)
          .join(' AND '),
      }),
      ExpressionAttributeNames,
    })
    .promise()

  return Attributes && format(Attributes)
}
