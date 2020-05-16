import * as rules from './validityRules'

export async function validate(field: string, value: any) {
  if (!(field in rules)) return `unknown field ${field}`
  return await rules[field](value)
}

export async function batchValidate(fields: { [field: string]: any }) {
  const format = (v: boolean | string): { valid: boolean; reason?: string } =>
    v === true || v === undefined
      ? { valid: true }
      : { valid: false, ...(typeof v === 'string' && { reason: v }) }

  return (
    await Promise.all(
      Object.entries(fields).map(([k, v]) =>
        validate(k, v).then(res => [k, res])
      ) as Promise<[string, any]>[]
    )
  ).map(([k, v]) => ({ field: k, ...format(v) }))
}

export default Object.assign(validate, { batch: batchValidate })
