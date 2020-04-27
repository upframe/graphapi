export const filterKeys = (
  obj: object,
  filter: ((k: string) => boolean) | string[]
) =>
  typeof obj === 'object'
    ? Object.fromEntries(
        Object.entries(obj).filter(([k]) =>
          Array.isArray(filter) ? filter.includes(k) : filter(k)
        )
      )
    : obj

export const map = (
  obj: object,
  func: ([string, unknown]) => [string, unknown]
) => Object.fromEntries(Object.entries(obj).map(func))

export const mapKeys = (
  obj: object,
  func: (k: string, v?: unknown) => string
) => map(obj, ([k, v]) => [func(k, v), v])

export const mapValues = (
  obj: object,
  func: (v: unknown, k: string) => unknown
) => map(obj, ([k, v]) => [k, func(v, k)])

export const replace = (
  obj: object,
  rep: { [k: string]: (v: unknown) => unknown }
) => map(obj, ([k, v]) => [k, k in rep ? rep[k](v) : v])
