import * as funcs from './objMethods'
export * from './objMethods'

type RemoveFirst<T extends any[]> = T['length'] extends 0
  ? undefined
  : ((...b: T) => void) extends (a, ...b: infer I) => void
  ? I
  : []

type Wrapped<T> = T &
  {
    [k in keyof typeof funcs]: (
      ...args: RemoveFirst<Parameters<typeof funcs[k]>>
    ) => Wrapped<T>
  }

export default function wrap<T>(obj: T): Wrapped<T> {
  return {
    ...obj,
    ...funcs.mapValues(
      funcs,
      (f: (...args: any[]) => any) => (...args: any[]) => wrap(f(obj, ...args))
    ),
  } as Wrapped<T>
}
