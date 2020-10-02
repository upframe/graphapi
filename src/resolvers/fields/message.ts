import resolver from '../resolver'

export const time = resolver<string, any>()(({ parent }) =>
  new Date(parent.time).toISOString()
)

export const content = resolver<
  string,
  any
>()(({ parent: { content, markup }, args: { fallback } }) =>
  !fallback || !markup ? content : null
)
