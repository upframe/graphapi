type Rule = (v: any) => boolean | string | undefined

const appendCheck = (check: Rule) => (rule: Rule) => (value: any) => {
  const res = rule(value)
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

export const name = blacklistChars(/\d/)((value: string) => {
  if (value.length < 3) return 'too short'
  if (value.length > 50) return 'too long'
})

export const handle = whitelistChars(/[\w\-.]/)((value: string) => {
  if (value.length < 3) return 'too short'
  if (value.length > 20) return 'too long'
})
