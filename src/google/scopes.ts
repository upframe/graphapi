export const googleOAuthScopes = {
  signIn: ['openid'],
  signUp: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
  calendar: ['https://www.googleapis.com/auth/calendar'],
} as const

export type GoogleOAuthScope = keyof typeof googleOAuthScopes
