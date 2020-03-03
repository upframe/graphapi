export const filterKeys = (
  obj: object,
  filter: ((k: string) => boolean) | string[]
) =>
  Object.fromEntries(
    Object.entries(obj).filter(([k]) =>
      Array.isArray(filter) ? filter.includes(k) : filter(k)
    )
  )
