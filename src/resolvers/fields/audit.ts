import resolver from '../resolver'

export const objects = resolver<any, any>()(
  ({ parent: { _objects, ...parent } }) => {
    parent = { ...parent, ...JSON.parse(parent.payload) }
    return ['user', 'space', 'editor', 'list']
      .map(k => _objects.find(({ id }) => id === parent[k]))
      .filter(Boolean)
  }
)

export const AuditObject = {
  __resolveType: resolver<string, any>()(({ parent }) =>
    'sidebar' in parent
      ? 'Space'
      : 'sort_pos' in parent
      ? 'List'
      : parent.role === 'user'
      ? 'User'
      : 'Mentor'
  ),
}
