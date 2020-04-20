import * as rules from './validityRules'

export default async function(field: string, value: any) {
  if (!(field in rules)) return `unknown field ${field}`
  return await rules[field](value)
}
