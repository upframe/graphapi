import { Model, User, Mentor, SocialMedia } from '.'

const ident = (...fields: string[]) =>
  Object.fromEntries(fields.map(v => [v, v]))
const external = (model: typeof Model) => (...fields: string[]) =>
  Object.fromEntries(fields.map(v => [v, model]))

export default new Map<typeof Model, MapInfo>([
  [
    User,
    {
      required: ['id', 'role', 'handle'],
      map: {
        ...ident(
          'id',
          'handle',
          'name',
          'email',
          'password',
          'role',
          'location'
        ),
        bio: 'biography',
        ...external(SocialMedia)('social'),
        ...external(Mentor)('visibility', 'title', 'company'),
      },
    },
  ],
  [
    Mentor,
    {
      required: ['id'],
      map: {
        ...ident('id', 'title', 'company'),
        visibility: 'listed',
      },
    },
  ],
])

interface MapInfo {
  required?: string[]
  map: Mapping
}
export interface Mapping {
  [gql: string]: string | Mapping | typeof Model
}
