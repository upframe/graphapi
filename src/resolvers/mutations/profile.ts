import * as obj from '../../utils/object'
import { User, UserHandles, UserTags, Tags } from '../../models'
import _ from 'lodash'
import AuthUser from 'src/authorization/user'
import resolver from '../resolver'
import { UserInputError } from 'apollo-server-lambda'
import MsgUser from '~/messaging/user'
import * as cache from '~/utils/cache'

const updateSocial = async (
  user: AuthUser,
  social: { platform: number; handle: string }[],
  knex: ResolverCtx['knex']
) => {
  const [added, removed] = _.partition(social ?? [], ({ handle }) => handle)
  await Promise.all([
    removed.length &&
      UserHandles.query()
        .delete()
        .whereInComposite(
          ['user_id', 'platform_id'],
          removed.map(({ platform }) => [user.id, platform])
        )
        .context({ user }),
    added.length &&
      knex.raw(
        `${knex('user_handles')
          .insert(
            added.map(({ platform, handle }) => ({
              platform_id: platform,
              user_id: user.id,
              handle,
            }))
          )
          .toString()} ON CONFLICT (user_id, platform_id) DO UPDATE SET handle=excluded.handle`
      ),
  ])
}

const updateTags = async (
  user: AuthUser,
  tags: { addedIds: number[]; removedIds: number[]; addedName: string[] }
) => {
  if (!user.groups.includes('mentor')) return

  const addTagsId = async ids =>
    await UserTags.query()
      .insert(ids.map(tag_id => ({ tag_id, user_id: user.id })))
      .asUser(user)

  const removeTagsId = async ids =>
    await UserTags.query()
      .where({ user_id: user.id })
      .whereIn('tag_id', ids)
      .delete()
      .asUser(user)

  const addTagsName = async names => {
    const exist = await Tags.query()
      .whereRaw(`name ILIKE ANY (ARRAY[${names.map(v => `'${v}'`).join(',')}])`)
      .asUser(user)
    if (exist.length)
      throw new UserInputError(
        `tags ${exist.map(({ name }) => name).join(', ')} already exist`
      )

    const created = ((await Tags.query()
      .insertAndFetch(names.map(name => ({ name })))
      .asUser(user)) as unknown) as Tags[]
    await UserTags.query()
      .insert(
        names.map(name => ({
          tag_id: created.find(tag => tag.name === name).id,
          user_id: user.id,
        }))
      )
      .asUser(user)
  }

  await Promise.all([
    tags.addedIds.length && addTagsId(tags.addedIds),
    tags.removedIds.length && removeTagsId(tags.removedIds),
    tags.addedName.length && addTagsName(tags.addedName),
  ])
}

export const updateProfile = resolver<User>()(
  async ({ args: { input }, ctx: { user }, query, knex }) => {
    await Promise.all([
      updateSocial(user, input.social, knex),
      updateTags(user, input.tags),
    ])

    const [data] = await Promise.all([
      query().upsertGraphAndFetch({
        id: user.id,
        ...obj.mapKeys(
          obj.filterKeys(input, [
            'name',
            'displayName',
            'handle',
            'location',
            'website',
            'biography',
            'headline',
          ]),
          k => (k === 'displayName' ? 'display_name' : k)
        ),
        ...(user.groups.includes('mentor') && {
          mentors: {
            id: user.id,
            ...obj.filterKeys(input, ['company']),
          },
        }),
      }),
      ...((['name', 'handle', 'biography', 'headline', 'tags'].some(
        k => k in input
      )
        ? [
            cache.userUpdated(
              {
                ...user,
                role: user.groups.includes('mentor') ? 'mentor' : 'user',
              },
              knex
            ),
          ]
        : []) as Promise<any>[]),
    ])

    return data
  }
)

export const setProfileVisibility = resolver<User>().isMentor(
  async ({ args: { visibility }, ctx: { id }, query, knex }) => {
    const [user] = await Promise.all([
      query().upsertGraphAndFetch({
        id,
        mentors: { id, listed: visibility === 'LISTED' },
      }),
      cache.userUpdated({ id }, knex, true),
    ])
    return user
  }
)

export const setProfileSearchability = resolver<User>().loggedIn(
  async ({ args: { searchable }, ctx: { id }, query }) =>
    await query().patchAndFetchById(id, { searchable })
)

export const updateNotificationPreferences = resolver<User>()(
  async ({ args: { input }, ctx: { id }, query }) => {
    const [res] = await Promise.allSettled([
      query().upsertGraphAndFetch({
        id,
        ...(typeof input.receiveEmails === 'boolean' && {
          allow_emails: input.receiveEmails,
        }),
        ...(typeof input.msgEmails === 'boolean' && {
          msg_emails: input.msgEmails,
        }),
        ...(input.slotReminder && {
          mentors: {
            id,
            slot_reminder_email: input.slotReminder.toLowerCase(),
          },
        }),
      }),
      typeof input.msgEmails === 'boolean' &&
        new MsgUser(id).wantsEmailNotifications(input.msgEmails),
    ])
    if (res.status === 'fulfilled') return res.value
  }
)

export const toggleMsgEmailNotifications = resolver().isAdmin(
  async ({ args: { active, ids, allUsers }, query }) => {
    if (!!ids === allUsers)
      throw new UserInputError('must provide either ids or all users')
    if (allUsers) ids = (await query.raw(User).select('id')).map(({ id }) => id)
    await query.raw(User).patch({ msg_emails: active }).whereIn('id', ids)
    await Promise.all(
      ids.map(id => new MsgUser(id).wantsEmailNotifications(active))
    )
  }
)

export const setTimezone = resolver<User>().loggedIn(
  async ({ args: { tz: timezone }, ctx: { id }, query }) =>
    await query().upsertGraphAndFetch({ id, timezone })
)

export const setInferTz = resolver<User>().loggedIn(
  async ({ args: { infer }, ctx: { id }, query }) =>
    await query().upsertGraphAndFetch({ id, tz_infer: infer })
)
