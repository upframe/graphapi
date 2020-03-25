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
    {
      effect: 'allow',
      action: 'read',
      resource: 'time_slots',
    },
    {
      effect: 'allow',
      action: 'read',
      resource: 'meetups',
    },
    {
      effect: 'allow',
      action: 'read',
      resource: 'profile_pictures',
    },
    {
      effect: 'allow',
      action: 'read',
      resource: 'tags',
    },
    {
      effect: 'allow',
      action: 'read',
      resource: 'lists',
    },
    {
      effect: 'allow',
      action: 'read',
      resource: 'socialmedia',
    },
  ],
}

export const maker: Group = {
  groups: [visitor],
  policies: [
    {
      effect: 'allow',
      action: 'read',
      resource: 'users.[email, allow_emails]',
      where: 'users.id = current.id',
    },
  ],
}

export const mentor: Group = {
  groups: [maker],
  policies: [
    {
      effect: 'allow',
      action: 'read',
      resource: 'mentors',
      where: 'mentors.id = current.id',
    },
  ],
}

export const admin: Group = {
  groups: [mentor],
  policies: [
    {
      effect: 'allow',
      action: 'create',
      resource: 'lists',
    },
    {
      effect: 'allow',
      action: 'delete',
      resource: 'lists',
    },
  ],
}
