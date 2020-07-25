export const batch = (arr: any[], batchSize: number): any[][] =>
  Array(Math.ceil(arr.length / batchSize))
    .fill(0)
    .map((_, i) => arr.slice(i * batchSize, (i + 1) * batchSize))

export const diff = <T extends any = unknown>(
  oldArray: T[],
  newArray: T[],
  {
    comp = (a: T, b: T) => a === b,
    added = true,
    deleted = true,
  }: {
    comp?: (a: T, b: T) => boolean
    added?: boolean
    deleted?: boolean
  } = {}
): { added: T[]; deleted: T[] } => ({
  ...(added && {
    added: newArray.filter(vNew => !oldArray.find(vOld => comp(vNew, vOld))),
  }),
  ...(deleted && {
    deleted: oldArray.filter(vOld => !newArray.find(vNew => comp(vOld, vNew))),
  }),
})
