export const filterKeys = <T extends object>(
  obj: T,
  filter: ((k: string) => boolean) | (keyof T)[]
) =>
  typeof obj === 'object'
    ? Object.fromEntries(
        Object.entries(obj).filter(([k]) =>
          Array.isArray(filter) ? filter.includes(k as keyof T) : filter(k)
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

export const mapValues = <T extends object, K extends keyof T>(
  obj: T,
  func: (v: T[K], k: K) => unknown
) => map(obj, ([k, v]) => [k, func(v, k)])

export const replace = (
  obj: object,
  rep: { [k: string]: (v: unknown) => unknown }
) => map(obj, ([k, v]) => [k, k in rep ? rep[k](v) : v])
