import * as rules from './validityRules'

export default function(field: string, value: any) {
  if (!(field in rules)) return `unknown field ${field}`
  return rules[field](value)
}
