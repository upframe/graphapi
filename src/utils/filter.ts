import { UserInputError } from '~/error'
import type { QueryBuilder } from 'objection'

const stringActions = [
  'equals',
  'begins_with',
  'ends_with',
  'includes',
] as const
const enumActions = ['equal'] as const
const actions = [...stringActions, ...enumActions] as const
type Action = typeof actions[number]

export type FilterExpression = {
  field: string
  action: Action
  value: string
}

type Opts = {
  allowedFields?: string[] | RegExp | '*'
}

export const parse = (
  expr: string,
  { allowedFields = '*' }: Opts = {}
): FilterExpression[] => {
  const exprs = expr.split(/\sand\s/i).map(v => v.trim())

  const expressions: FilterExpression[] = []

  for (const expr of exprs) {
    const parts: string[] = []
    let inQuote = false
    let curStr = ''
    for (const c of expr) {
      if (c === ' ' && !inQuote) {
        if (curStr) parts.push(curStr)
        curStr = ''
        continue
      }
      curStr += c
      if (c === "'") inQuote = !inQuote
    }
    if (curStr) parts.push(curStr)

    if (parts.length !== 3)
      throw new UserInputError(
        `invalid filter expression '${expr}', expression must consist of field, action & value`
      )

    let [field, action, value] = parts
    action = action.toLowerCase()

    if (
      allowedFields !== '*' &&
      (Array.isArray(allowedFields)
        ? !allowedFields.includes(field)
        : !allowedFields.test(field))
    )
      throw new UserInputError(`can't filter on field '${field}'`)

    if (!actions.includes(action as Action))
      throw new UserInputError(`unknown filter action '${action}'`)

    if (
      stringActions.includes(action as typeof stringActions[number]) &&
      !/^'[^']+'$/.test(value)
    )
      throw new UserInputError(
        `invalid value ${value} for action '${action}', value must be string`
      )

    expressions.push({ field, action, value } as FilterExpression)
  }

  return expressions
}

export const buildQuery = <T extends QueryBuilder<any, any[] | Model[]>>(
  query: T,
  filters: FilterExpression[]
): T => {
  for (const { field, action, value } of filters) {
    switch (action) {
      case 'begins_with':
        query = query.andWhere(field, 'ILIKE', `${value.slice(1, -1)}%`)
        break
      case 'ends_with':
        query = query.andWhere(field, 'ILIKE', `%${value.slice(1, -1)}`)
        break
      case 'includes':
        query = query.andWhere(field, 'ILIKE', `%${value.slice(1, -1)}%`)
        break
      case 'equals':
        query = query.andWhere(field, 'ILIKE', value.slice(1, -1))
        break
      case 'equal':
        query = query.andWhere(field, '=', value)
        break
      default:
        throw Error(`unhandled filter action '${action}'`)
    }
  }

  return query
}
