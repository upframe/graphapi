export const batch = (arr: any[], batchSize: number): any[][] =>
  Array(Math.ceil(arr.length / batchSize))
    .fill(0)
    .map((_, i) => arr.slice(i * batchSize, (i + 1) * batchSize))
