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
      where: 'users.id != current.id',
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
      where: 'mentors.id = current.id',
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
