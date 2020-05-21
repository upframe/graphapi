import * as obj from '../../utils/object'
import { User, UserHandles, UserTags, Tags } from '../../models'
import _ from 'lodash'
import AuthUser from 'src/authorization/user'
import resolver from '../resolver'
import { UserInputError } from 'apollo-server-lambda'

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

    return await query().upsertGraphAndFetch({
      id: user.id,
      ...obj.filterKeys(input, [
        'name',
        'handle',
        'location',
        'website',
        'biography',
      ]),
      ...(user.groups.includes('mentor') && {
        mentors: {
          id: user.id,
          ...obj.filterKeys(input, ['headline', 'company']),
        },
      }),
    })
  }
)

export const setProfileVisibility = resolver<User>()(
  async ({ args: { visibility }, ctx: { id }, query }) =>
    await query().upsertGraphAndFetch({
      id,
      mentors: { id, listed: visibility === 'LISTED' },
    })
)

export const setProfileSearchability = resolver<User>().loggedIn(
  async ({ args: { searchable }, ctx: { id }, query }) =>
    await query().patchAndFetchById(id, { searchable })
)

export const updateNotificationPreferences = resolver<User>()(
  async ({ args: { input }, ctx: { id }, query }) => {
    return query().upsertGraphAndFetch({
      id,
      ...(typeof input.receiveEmails === 'boolean' && {
        allow_emails: input.receiveEmails,
      }),
      ...(input.slotReminder && {
        mentors: {
          id,
          slot_reminder_email: input.slotReminder.toLowerCase(),
        },
      }),
    })
  }
)
