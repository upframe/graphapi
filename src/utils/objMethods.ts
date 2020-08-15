export const filterKeys = <T extends object>(
  obj: T,
  filter: ((k: string) => boolean) | (keyof T)[] | RegExp
) =>
  typeof obj === 'object'
    ? Object.fromEntries(
        Object.entries(obj).filter(([k]) =>
          Array.isArray(filter)
            ? filter.includes(k as keyof T)
            : typeof filter === 'function'
            ? filter(k)
            : filter.test(k)
        )
      )
    : obj

export const map = <T>(
  obj: T,
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

export const set = (obj: object, k: string, v: any) => ({
  ...obj,
  [k]: typeof v === 'function' ? v(obj[k]) : v,
})

export const update = (obj: object, k: string, v: any) =>
  k in obj ? set(obj, k, v) : obj

export const rename = (obj: object, kOld: string, kNew: string) =>
  mapKeys(obj, k => (k === kOld ? kNew : k))
