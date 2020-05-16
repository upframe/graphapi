import resolver from '../resolver'

export const name = resolver<string, any>()(({ parent }) => parent.summary)

export const start = resolver<string, any>()(
  ({ parent }) => parent.start?.dateTime
)

export const end = resolver<string, any>()(({ parent }) => parent.end?.dateTime)
