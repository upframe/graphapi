const getBoolean = (info: any, { arguments: [{ value }] }): boolean =>
  value.kind === 'BooleanValue'
    ? value.value
    : info.variableValues[value.name.value]

function isExcludedByDirective(info: any, { directives }): boolean {
  if (!directives?.length) return false
  for (const directive of directives)
    if (
      getBoolean(info, directive) ===
      (directive.name.value === 'include' ? false : true)
    )
      return true
  return false
}

type Fields = { [k: string]: Fields | boolean }
export default function getFields(
  info: any,
  asts = info.fieldASTs ?? info.fieldNodes
): Fields {
  if (!Array.isArray(asts)) asts = [asts]

  const selections = asts.flatMap(ast => ast?.selectionSet?.selections ?? [])

  let aggr = {}
  for (const selection of selections) {
    if (isExcludedByDirective(info, selection)) continue
    if (selection.kind === 'Field')
      aggr[selection.name.value] = selection.selectionSet
        ? getFields(info, selection)
        : true
    else if (selection.kind === 'InlineFragment')
      Object.assign(aggr, getFields(info, selection))
    else if (selection.kind === 'FragmentSpread')
      Object.assign(aggr, getFields(info, info.fragments[selection.name.value]))
  }
  return aggr
}
