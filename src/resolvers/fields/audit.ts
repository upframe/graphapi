import resolver from '../resolver'
import logger from '~/logger'

export const editor = resolver<
  any,
  any
>()(({ parent: { _editorId, _objects } }) =>
  _objects?.find(({ id }) => id === _editorId)
)

export const objects = resolver<any, any>()(
  ({ parent: { _objects, ...parent } }) => {
    parent = { ...parent, ...JSON.parse(parent.payload) }
    const res = ['user', 'space']
      .map(k => _objects.find(({ id }) => id === parent[k]))
      .filter(Boolean)
    logger.info({ res, parent })
    return res
  }
)

export const AuditObject = {
  __resolveType: resolver<string, any>()(({ parent }) =>
    'sidebar' in parent ? 'Space' : parent.role === 'user' ? 'User' : 'Mentor'
  ),
}
