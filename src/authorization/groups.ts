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
      resource: 'mentors.[id, title, company, time_slots]',
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
    {
      effect: 'allow',
      action: 'create',
      resource: 'users',
    },
    {
      effect: 'allow',
      action: 'create',
      resource: 'meetups',
      where: 'meetups.mentee_id = current.id',
    },
  ],
}

export const user: Group = {
  name: 'user',
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
    {
      effect: 'allow',
      action: 'delete',
      resource: 'users',
      where: 'users.id = current.id',
    },
    {
      effect: 'allow',
      action: 'delete',
      resource: 'profile_pictures',
      where: 'profile_pictures.user_id = current.id',
    },
  ],
}

export const mentor: Group = {
  name: 'mentor',
  groups: [user],
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
    {
      effect: 'allow',
      action: 'create',
      resource: 'time_slots',
      where: 'time_slots.mentor_id = current.id',
    },
    {
      effect: 'allow',
      action: 'delete',
      resource: 'time_slots',
      where: 'time_slots.mentor_id = current.id',
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
    {
      effect: 'allow',
      action: 'delete',
      resource: 'users',
    },
    {
      effect: 'allow',
      action: 'read',
      resource: 'users',
    },
    {
      effect: 'allow',
      action: 'read',
      resource: 'mentors',
    },
    {
      effect: 'allow',
      action: 'delete',
      resource: 'meetups',
    },
    {
      effect: 'allow',
      action: 'update',
      resource: 'meetups',
    },
  ],
}
