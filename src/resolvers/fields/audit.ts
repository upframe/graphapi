import resolver from '../resolver'

export const editor = resolver<
  any,
  any
>()(({ parent: { _editorId, _editors } }) =>
  _editors?.find(({ id }) => id === _editorId)
)
