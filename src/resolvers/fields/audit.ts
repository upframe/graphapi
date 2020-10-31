import resolver from '../resolver'

export const objects = resolver<any, any>()(
  ({ parent: { _objects, ...parent } }) => {
    parent = { ...parent, ...JSON.parse(parent.payload) }
    return ['user', 'space', 'editor']
      .map(k => _objects.find(({ id }) => id === parent[k]))
      .filter(Boolean)
  }
)

export const AuditObject = {
  __resolveType: resolver<string, any>()(({ parent }) =>
    'sidebar' in parent ? 'Space' : parent.role === 'user' ? 'User' : 'Mentor'
  ),
}
