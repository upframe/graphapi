import knex from '../../db'
import * as obj from '../../utils/object'
import { User, UserHandles, UserTags, Tags } from '../../models'
import _ from 'lodash'
import AuthUser from 'src/authorization/user'
import resolver from '../resolver'

const updateSocial = async (
  user: AuthUser,
  social: { platform: number; handle: string }[]
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

const updateTags = async (user: AuthUser, tags: string[]) => {
  if (!user.groups.includes('mentor')) return

  tags = Array.from(new Set((tags ?? []).map(v => v.toLowerCase())))
  if (tags.length) {
    const currentTags = await UserTags.query()
      .where({ user_id: user.id })
      .context({ user })
    let existing = await Tags.query()
    let unknown = tags.filter(tag => !existing.find(({ name }) => name === tag))
    if (unknown.length)
      existing = [
        ...existing,
        ...(await Tags.query()
          .insertAndFetch(unknown.map(name => ({ name })))
          .context({ user })),
      ]
    const currentTagNames = currentTags.map(
      ({ tag_id }) => existing.find(({ id }) => id === tag_id).name
    )
    const newTags = tags
      .filter(tag => !currentTagNames.includes(tag))
      .map(name => existing.find(tag => tag.name === name).id)

    if (newTags.length)
      await UserTags.query()
        .insert(newTags.map(tag_id => ({ tag_id, user_id: user.id })))
        .context({ user })

    const removedTags = currentTagNames
      .filter(tag => !tags.includes(tag))
      .map(tag => existing.find(({ name }) => name === tag).id)

    if (removedTags.length)
      await UserTags.query()
        .del()
        .where({ user_id: user.id })
        .whereIn('tag_id', removedTags)
        .context({ user })
  }
}

export const updateProfile = resolver<User>()(
  async ({ args: { input }, ctx: { user }, query }) => {
    await Promise.all([
      updateSocial(user, input.social),
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
          ...obj.filterKeys(input, ['title', 'company']),
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
