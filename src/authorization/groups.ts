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
      resource:
        'users.[email, allow_emails, tz_infer, joined, invitedBy, lists]',
    },
    {
      effect: 'allow',
      action: 'read',
      resource: 'mentors.[id, company, time_slots]',
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
      effect: 'disallow',
      action: 'read',
      resource: 'sort_pos',
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
    },
    {
      effect: 'allow',
      action: 'read',
      resource: 'invites',
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
      resource: 'users.[email, allow_emails, tz_infer]',
      where: 'users.id = current.id',
    },
    {
      effect: 'allow',
      action: 'update, delete',
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
      resource: 'profile_pictures',
      where: 'profile_pictures.user_id = current.id',
    },
    {
      effect: 'allow',
      action: 'create',
      resource: 'tags',
    },
    {
      effect: 'allow',
      action: 'create',
      resource: 'invites',
      where: 'invites.issuer = current.id',
    },
    {
      effect: 'allow',
      action: '*',
      resource: 'signin_upframe',
      where: 'signin_upframe.email = current.email',
    },
    {
      effect: 'allow',
      action: '*',
      resource: 'connect_google',
      where: 'connect_google.user_id = current.id',
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
    { effect: 'allow', action: '*', resource: 'users' },
    { effect: 'allow', action: '*', resource: 'mentors' },
    { effect: 'allow', action: '*', resource: 'meetups' },
    { effect: 'allow', action: '*', resource: 'lists' },
    { effect: 'allow', action: '*', resource: 'user_lists' },
    { effect: 'allow', action: '*', resource: 'tokens' },
    { effect: 'allow', action: '*', resource: 'tags' },
    { effect: 'allow', action: '*', resource: 'connect_google' },
    { effect: 'allow', action: '*', resource: 'signup' },
    { effect: 'allow', action: '*', resource: 'signin_upframe' },
    { effect: 'allow', action: '*', resource: 'invites' },
    { effect: 'allow', action: '*', resource: 'spaces' },
  ],
}
