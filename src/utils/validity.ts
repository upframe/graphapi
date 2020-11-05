import * as _rules from './validityRules'
const rules: { [name: string]: _rules.Rule } = _rules

export async function validate(
  field: string,
  value: any,
  knex: ResolverCtx['knex']
) {
  if (!(field in rules)) return `unknown field ${field}`
  return await rules[field](value, knex)
}

export async function batchValidate(
  fields: { [field: string]: any },
  knex: ResolverCtx['knex']
) {
  const format = (v: boolean | string): { valid: boolean; reason?: string } =>
    v === true || v === undefined
      ? { valid: true }
      : { valid: false, ...(typeof v === 'string' && { reason: v }) }

  return (
    await Promise.all(
      Object.entries(fields).map(([k, v]) =>
        validate(k, v, knex).then(res => [k, res])
      ) as Promise<[string, any]>[]
    )
  ).map(([k, v]) => ({ field: k, ...format(v) }))
}

export default Object.assign(validate, { batch: batchValidate })

export const isUUID = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  )
