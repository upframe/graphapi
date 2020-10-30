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
export const owners = group(({ is_owner }) => is_owner)

export const mentors = resolver<User, Space>()(
  async ({ query, ctx: { user }, parent, knex, args: { includeOwners } }) => {
    if (!(parent as any).isMember && !user.groups.includes('admin')) return null
    return await query({
      entryName: 'Person',
      include: 'mentors',
      join: true,
    })
      .select(knex.raw('LEAST(mentors.score, 1) as rank'))
      .orderBy('rank', 'DESC')
      .findByIds(
        (parent as any)._members
          .filter(
            ({ is_mentor, is_owner }) =>
              is_mentor && (includeOwners || !is_owner)
          )
          .map(({ user_id }) => user_id)
      )
  }
)

export const inviteLinks = resolver<any, Space>()(({ parent }) => {
  if (!(parent as any).isOwner) return
  return Object.fromEntries(
    ['founder', 'mentor', 'owner'].map(v => [v, (parent as any)[`${v}_invite`]])
  )
})

const img = (keys: string[], base: string) =>
  keys && {
    base,
    versions: keys.map(key => ({
      key,
      width: key.match(/(\d+)(?=x)/)[1],
      height: key.match(/x(\d+)/)[1],
      type: key.match(/\.([\w]+)$/)[1],
    })),
  }

export const photo = resolver<any, Space>()(({ parent }) =>
  img(parent.space_imgs, `${process.env.ASSET_CDN}spaces/${parent.id}/`)
)

export const cover = resolver<any, Space>()(({ parent }) =>
  img(parent.cover_imgs, `${process.env.ASSET_CDN}spaces/${parent.id}/`)
)

export const isMentor = resolver<
  boolean,
  Space
>()(async ({ parent, args: { user }, knex }) =>
  !(parent as any).isMember
    ? null
    : !user
    ? (parent as any).isMentor
    : (
        await knex('user_spaces')
          .where({ space_id: parent.id, user_id: user })
          .first()
      ).is_mentor
)

export const isOwner = resolver<
  boolean,
  Space
>()(async ({ parent, args: { user }, knex }) =>
  !(parent as any).isMember
    ? null
    : !user
    ? (parent as any).isOwner
    : (
        await knex('user_spaces')
          .where({ space_id: parent.id, user_id: user })
          .first()
      ).is_owner
)
