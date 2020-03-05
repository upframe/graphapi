export const filterKeys = (
  obj: object,
  filter: ((k: string) => boolean) | string[]
) =>
  Object.fromEntries(
    Object.entries(obj).filter(([k]) =>
      Array.isArray(filter) ? filter.includes(k) : filter(k)
    )
  )

export const map = (
  obj: object,
  func: ([string, unknown]) => [string, unknown]
) => Object.fromEntries(Object.entries(obj).map(func))

export const mapValues = (
  obj: object,
  func: (v: unknown, k: string) => unknown
) => map(obj, ([k, v]) => [k, func(v, k)])
