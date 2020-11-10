import resolver from '../resolver'

export const __resolveType = resolver<string, any>()(({ parent }) =>
  'authComplete' in parent
    ? 'SignUpInfo'
    : parent.role === 'user'
    ? 'User'
    : 'Mentor'
)
