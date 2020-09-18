export const batch = (arr: any[], batchSize: number): any[][] =>
  Array(Math.ceil(arr.length / batchSize))
    .fill(0)
    .map((_, i) => arr.slice(i * batchSize, (i + 1) * batchSize))

export const group = <T extends Array<unknown>>(
  arr: T,
  select: (v: T[number]) => any
): T[] => {
  return Object.values(
    arr.reduce((a: object, c) => {
      const id = select(c)
      if (!(id in a)) a[id] = []
      a[id].push(c)
      return a
    }, {})
  )
}

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

export interface genericUser {
  name: string
}

export const sortForStartingTerm = <T extends genericUser>(
  array: T[],
  term: string
): T[] => {
  return array.sort((a, b) => {
    if (a.name.toLowerCase().startsWith(term.toLowerCase())) return -1
    else if (b.name.toLowerCase().startsWith(term.toLowerCase())) return 1
    return 0
  })
}
