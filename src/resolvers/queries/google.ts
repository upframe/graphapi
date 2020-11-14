import resolver from '../resolver'
import { generateAuthUrl } from '~/google'
import type { GoogleOAuthScope } from '~/google/scopes'

export const googleAuthUrl = resolver<string>()<{
  redirect: string
  state: string
  scope: 'SIGN_IN' | 'SIGN_UP' | 'CALENDAR'
  email?: string
}>(async ({ args: { scope, ...args }, knex, ctx: { id } }) => {
  const scopes: GoogleOAuthScope[] = ['signIn']
  if (scope !== 'SIGN_IN') scopes.push('signUp')
  if (scope === 'CALENDAR') {
    scopes.push('calendar')
    const signIn =
      id && (await knex('connect_google').where({ user_id: id }).first())
    args.email = signIn?.email
  }
  return generateAuthUrl(args, ...scopes)
})
