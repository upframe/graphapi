import { UserInputError } from '~/error'

export type ForwardPageOpt = {
  first: number
  after: string
}

export type BackwardPageOpt = {
  last: number
  before: string
}

type PaginationDir = 'forward' | 'backward'
export type PaginationArgs<
  direction extends PaginationDir | 'unknown' = 'unknown'
> = direction extends 'forward'
  ? ForwardPageOpt
  : direction extends 'backward'
  ? BackwardPageOpt
  : ForwardPageOpt | BackwardPageOpt

export const dir = (args: PaginationArgs): PaginationDir =>
  'first' in args || 'after' in args ? 'forward' : 'backward'

export const flatten = (
  args: PaginationArgs
): { cursor: string; limit: number; direction: PaginationDir } =>
  dir(args) === 'forward'
    ? {
        cursor: (<PaginationArgs<'forward'>>args).after,
        limit: (<PaginationArgs<'forward'>>args).first,
        direction: 'forward',
      }
    : {
        cursor: (<PaginationArgs<'backward'>>args).before,
        limit: (<PaginationArgs<'backward'>>args).last,
        direction: 'backward',
      }

export const validate = (args: any) => {
  const direction = dir(args)
  if (
    direction === 'forward'
      ? args.last !== undefined || args.before !== undefined
      : args.first !== undefined || args.after !== undefined
  )
    throw new UserInputError(
      `${dir} pagination only expects expects arguments ${(direction ===
      'forward'
        ? ['first', 'after']
        : ['last', 'before']
      )
        .map(v => `'${v}'`)
        .join(' and ')}`
    )
}
