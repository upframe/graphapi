export const expand = (path: string): string[] => {
  let segs = path.split('.')
  const compInd = segs.findIndex(seg => /^\[.+\]$/.test(seg))
  if (compInd === -1) return [segs.join('.')]
  const before = segs.slice(0, compInd)
  const after = segs.slice(compInd + 1)
  return segs[compInd]
    .replace(/^\[(.+)\]$/, '$1')
    .split(',')
    .map(v => [...before, v.trim(), ...after].join('.'))
    .flatMap(expand)
}

export const getPaths = (obj: any, ...path: string[]) =>
  typeof obj !== 'object'
    ? path.join('.')
    : Object.entries(obj).flatMap(([k, v]) => getPaths(v, ...path, k))
