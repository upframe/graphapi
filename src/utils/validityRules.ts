import knex from '../db'

type Rule = (
  v: any
) => boolean | string | undefined | Promise<boolean | string | undefined>
const appendCheck = (check: Rule) => (rule: Rule) => async (value: any) => {
  const res = await rule(value)
  if (typeof res === 'string' || res === false) return res
  return check(value)
}

const blacklistChars = (blacklist: RegExp) =>
  appendCheck((value: string) => {
    for (const c of value)
      if (blacklist.test(c)) return `invalid character "${c}"`
  })

const whitelistChars = (whitelist: RegExp) =>
  appendCheck((value: string) => {
    for (const c of value)
      if (!whitelist.test(c)) return `invalid character "${c}"`
  })

export const name = blacklistChars(/[\d_.!?,;@+=<>]/)((value: string) => {
  if (value.length < 3) return 'too short'
  if (value.length > 50) return 'too long'
})

export const handle = whitelistChars(/[\w\-.]/)(async (value: string) => {
  if (value.length < 3) return 'too short'
  if (value.length > 20) return 'too long'
  if (reserved.includes(value.toLowerCase())) return 'already taken'
  if (
    await knex('users')
      .where('handle', 'ilike', value)
      .first()
  )
    return 'already taken'
})

export const biography = (value: string) => {
  if (value.length < 20) return 'too short'
}

export const location = (value: string) => {
  if (value.length < 4) return 'too short'
}

export const headline = (value: string) => {
  if (value.length < 3) return 'too short'
}

const reserved = [
  '404',
  'about',
  'accept',
  'account',
  'admin',
  'chat',
  'code',
  'confirm',
  'contact',
  'deny',
  'group',
  'group',
  'list',
  'login',
  'logout',
  'meetup',
  'message',
  'msg',
  'notfound',
  'organisation',
  'organization',
  'privacy',
  'refuse',
  'register',
  'reset',
  'room',
  'search',
  'setting',
  'signin',
  'signout',
  'signup',
  'space',
  'statistic',
  'stat',
  'sub',
  'sync',
  'tag',
  'tag',
  'token',
  'unknown',
  'upframe',
].flatMap(v => [v, v + 's'])
