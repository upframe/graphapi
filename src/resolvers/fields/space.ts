import resolver from '../resolver'
import { User, Space } from '~/models'

type Filter = (
  user: { is_mentor: boolean; is_owner: boolean },
  args: any
) => boolean

const group = (filter: Filter) =>
  resolver<User, Space>()(async ({ parent, ctx: { user }, query, args }) => {
    if (!parent.isMember && !user.groups.includes('admin')) return null
    return await query({
      entryName: 'Person',
    }).findByIds(
      (parent as any)._members
        .filter(v => filter(v, args))
        .map(({ user_id }) => user_id)
    )
  })

export const members = group(({ is_mentor }) => !is_mentor)
export const mentors = group(
  ({ is_mentor, is_owner }, { includeOwners }) =>
    is_mentor && (includeOwners || !is_owner)
)
export const owners = group(({ is_owner }) => is_owner)
