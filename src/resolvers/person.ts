export default {
  __resolveType({ type }) {
    if (type === 'user') return 'User'
    if (type === 'mentor') return 'Mentor'
  },

  id: ({ uid }) => uid,

  profilePictures({ profilePictures, profilePic }) {
    return [
      ...(profilePictures
        ? Object.entries(profilePictures)
            .filter(([k, v]) => v && k.startsWith('pic'))
            .map(([k, v]) => {
              const [, size, type] =
                k.match(/^pic([0-9]+|Max)(Jpeg|Webp)/) ?? []
              return {
                ...(size && { size: parseInt(size, 10) || null }),
                ...(type && { type: type.toLowerCase() }),
                url: v,
              }
            })
        : []),
      ...(profilePic ? [{ url: profilePic }] : []),
    ]
  },

  social: obj =>
    Object.fromEntries(
      socialPlatforms.flatMap(name => (obj[name] ? [[name, obj[name]]] : []))
    ),
}

const socialPlatforms = [
  'dribbble',
  'facebook',
  'github',
  'linkedin',
  'twitter',
]
