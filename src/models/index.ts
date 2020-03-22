export { Model } from 'objection'
import { buildAccessGraph, accessFilter } from '../authorization'
import { Maker } from '../authorization/roles'

export function augment<M extends typeof Model>(model: M): M {
  const _controlAccess = (item: M, id: string) => {
    const data = { [model.tableName]: item }
    const relations = Object.fromEntries(
      Object.entries(item)
        .filter(([k]) => k in model.relationMappings)
        .map(([k, result]) => {
          const relation = model.relationMappings[k]?.modelClass
          return [
            k,
            relation?._augmented ? relation?.afterFind({ result }) : result,
          ]
        })
    )
    const filtered = accessFilter(data, buildAccessGraph(Maker))
    return { ...filtered[model.tableName], ...relations }
  }

  model.afterFind = ({ result, context, relation }) => {
    if (relation) return
    return Array.isArray(result)
      ? result.map(v => _controlAccess(v, context.id))
      : _controlAccess(result, context?.id)
  }

  Object.assign(model, { _augmented: true })

  return model
}

export * from './list'
export * from './tags'
export * from './meetups'
export * from './slots'
export * from './socialmedia'
export * from './userHandles'
export * from './profilePicture'
export * from './userTags'
export * from './mentor'
export * from './user'
