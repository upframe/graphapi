import resolver from '../resolver'
import o from '~/utils/object'
import { checkSpaceAdmin } from '~/utils/space'
import { s3 } from '~/utils/aws'
import { UserInputError } from '~/error'
import type { Space } from '~/models'

export * from './space'

export const spaces = resolver<Space>().isAdmin(
  async ({ query }) => await query()
)

export const space = resolver<Space>()(
  async ({ query, args: { id, handle }, ctx, knex }) => {
    if (!id && !handle) throw new UserInputError('must provide id or handle')

    const queryMember = async space_id => {
      const _members = await knex('user_spaces').where({ space_id })
      const user = _members.find(({ user_id }) => user_id === ctx.id)
      return {
        _members,
        isMember: !!user,
        isMentor: user?.is_mentor ?? false,
        isOwner: user?.is_owner ?? false,
      }
    }

    if (id) {
      const [a, b] = await Promise.all([query().findById(id), queryMember(id)])
      return ({ ...a, ...b } as unknown) as Space
    }

    const space = await query()
      .where(knex.raw('LOWER(handle)'), '=', handle.toLowerCase())
      .first()

    return ({
      ...space,
      ...(await queryMember(space.id)),
    } as unknown) as Space
  }
)

export const spaceImgUploadLink = resolver<string>()<{
  spaceId: string
  type: 'COVER' | 'PROFILE'
  ext: string
}>(async ({ args: { spaceId, type, ext }, ctx: { user }, knex }) => {
  await checkSpaceAdmin(spaceId, user, knex, 'create upload links for')
  return await s3.getSignedUrlPromise('putObject', {
    Bucket: process.env.USER_MEDIA_BUCKET,
    Key: `spaces/${spaceId}/${
      type === 'COVER' ? 'cover' : 'space'
    }-${Date.now().toString().slice(0, -6)}-raw.${ext}`,
    ContentType: `image/${ext}`,
    ACL: 'public-read',
    Expires: 60 * 5,
  })
})

export const spaceInvite = resolver<Space>()(
  async ({ knex, args: { token }, ctx: { id } }) => {
    const [space] = await knex('space_invites')
      .select(
        'spaces.*',
        ...(id
          ? [
              knex.raw(
                `EXISTS(${knex('user_spaces').where({
                  user_id: id,
                  space_id: knex.raw('spaces.id'),
                })}) as is_member`
              ),
            ]
          : [])
      )
      .leftJoin('spaces', { 'spaces.id': 'space_invites.space' })
      .where({ 'space_invites.id': token })

    if (!space) return null

    space.isMember = space.is_member
    return o(space).filterKeys([
      'id',
      'name',
      'handle',
      'description',
      'isMember',
      'space_imgs',
      'cover_imgs',
    ])
  }
)
