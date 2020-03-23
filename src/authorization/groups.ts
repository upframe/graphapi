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
    },
    {
      effect: 'allow',
      action: 'read',
      resource: 'mentors.[id, title, company]',
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
