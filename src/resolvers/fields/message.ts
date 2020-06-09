import resolver from '../resolver'

export const time = resolver<string, any>()(({ parent }) =>
  new Date(parent.time).toISOString()
)
