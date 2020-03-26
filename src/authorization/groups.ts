export const visitor: Group = {
  name: 'visitor',
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
    {
      effect: 'allow',
      action: 'read',
      resource: 'user_handles',
    },
    {
      effect: 'allow',
      action: 'read',
      resource: 'user_tags',
    },
  ],
}

export const maker: Group = {
  name: 'maker',
  groups: [visitor],
  policies: [
    {
      effect: 'allow',
      action: 'read',
      resource: 'users.[email, allow_emails]',
      where: 'users.id = current.id',
    },
    {
      effect: 'allow',
      action: 'update',
      resource: 'users',
      where: 'users.id = current.id',
    },
    {
      effect: 'allow',
      action: 'delete',
      resource: 'user_handles',
      where: 'user_handles.user_id = current.id',
    },
  ],
}

export const mentor: Group = {
  name: 'mentor',
  groups: [maker],
  policies: [
    {
      effect: 'allow',
      action: 'read',
      resource: 'mentors',
      where: 'mentors.id = current.id',
    },
    {
      effect: 'allow',
      action: 'update',
      resource: 'mentors',
      where: 'mentors.id = current.id',
    },
    {
      effect: 'allow',
      action: 'create',
      resource: 'tags',
    },
    {
      effect: 'allow',
      action: 'create',
      resource: 'user_tags',
    },
    {
      effect: 'allow',
      action: 'delete',
      resource: 'user_tags',
    },
  ],
}

export const admin: Group = {
  name: 'admin',
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
    {
      effect: 'allow',
      action: 'create',
      resource: 'user_lists',
    },
    {
      effect: 'allow',
      action: 'delete',
      resource: 'user_lists',
    },
  ],
}
