export const Maker: Group = {
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
