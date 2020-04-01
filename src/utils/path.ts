import _ from 'lodash'

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
  typeof obj !== 'object' || obj === null || obj instanceof Date
    ? path.join('.')
    : Object.entries(obj).flatMap(([k, v]) => getPaths(v, ...path, k))

export const fromPaths = (path: string): AccessGraph => {
  path.trim()
  let paths = ['']
  let lvl = 0
  if (/^\[.*\]$/.test(path)) {
    path = path.replace(/^\[(.*)\]$/, '$1')
    for (let char of path) {
      if (char === ',' && lvl === 0) {
        paths.push('')
        continue
      }
      if (char === '[') lvl++
      if (char === ']') lvl--
      paths[paths.length - 1] += char
    }
  } else paths = [path]

  return _.merge(
    {},
    ...paths
      .flatMap(path => expand(path.trim()))
      .map(path => _.set({}, path, true))
  )
}
