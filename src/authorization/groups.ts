const currentUser = ({ users }, { id }) => users?.id && users.id !== id
const currentMentor = ({ mentors }, { id }) => mentors?.id && mentors.id !== id

export const visitor: Group = {
  groups: [],
  policies: [
    {
      effect: 'allow',
      action: 'read',
      resource: 'users',
    },
    {
      effect: 'disallow',
      action: 'read',
      resource: 'users.[email, allow_emails]',
      where: currentUser,
    },
    {
      effect: 'allow',
      action: 'read',
      resource: 'mentors',
    },
    {
      effect: 'allow',
      action: 'read',
      resource: 'mentors.[id, title, company]',
    },
    {
      effect: 'allow',
      action: 'read',
      resource: 'mentors',
      where: currentMentor,
    },
  ],
}

export const maker: Group = {
  groups: [visitor],
  policies: [],
}

export const mentor: Group = {
  groups: [maker],
  policies: [],
}
