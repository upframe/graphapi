import query from '../../utils/buildQuery'
import knex from '../../db'
import * as obj from '../../utils/object'
import { User, UserHandles, UserTags, Tags, Mentor } from '../../models'
import { AuthenticationError, UserInputError } from '../../error'

export default {
  updateProfile: async (_, { input }, { id, role }) => {
    if (!id) throw new AuthenticationError('not logged in')

    const handles = (input.social ?? [])
      .filter(({ platform, handle }) => platform && handle)
      .map(({ platform, handle }) => ({
        user_id: id,
        platform_id: platform,
        handle,
      }))
    const removedHandles = (input.social ?? [])
      .filter(({ platform, handle }) => platform && !handle)
      .map(({ platform }) => platform)

    await Promise.all([
      handles.length &&
        knex.raw(
          `${knex('user_handles')
            .insert(handles)
            .toString()} ON CONFLICT (user_id, platform_id) DO UPDATE SET handle=excluded.handle`
        ),
      removedHandles.length &&
        UserHandles.query()
          .delete()
          .whereInComposite(
            ['user_id', 'platform_id'],
            removedHandles.map(v => [id, v])
          ),
    ])

    const tags: string[] = Array.from(
      new Set((input.tags ?? []).map(v => v.toLowerCase()))
    )
    if (tags.length) {
      const currentTags = await UserTags.query().where({ user_id: id })
      let existing = await Tags.query()
      let unknown = tags.filter(
        tag => !existing.find(({ name }) => name === tag)
      )
      if (unknown.length)
        existing = [
          ...existing,
          ...(await Tags.query().insertAndFetch(
            unknown.map(name => ({ name }))
          )),
        ]
      const currentTagNames = currentTags.map(
        ({ tag_id }) => existing.find(({ id }) => id === tag_id).name
      )
      const newTags = tags
        .filter(tag => !currentTagNames.includes(tag))
        .map(name => existing.find(tag => tag.name === name).id)

      if (newTags.length)
        await UserTags.query().insert(
          newTags.map(tag_id => ({ tag_id, user_id: id }))
        )

      const removedTags = currentTagNames
        .filter(tag => !tags.includes(tag))
        .map(tag => existing.find(({ name }) => name === tag).id)

      if (removedTags.length)
        await UserTags.query()
          .del()
          .where({ user_id: id })
          .whereIn('tag_id', removedTags)
    }

    return await User.query()
      .upsertGraphAndFetch({
        id,
        ...obj.filterKeys(input, [
          'name',
          'handle',
          'location',
          'website',
          'biography',
        ]),
        ...(role !== 'user' && {
          mentors: { id, ...obj.filterKeys(input, ['title', 'company']) },
        }),
      })
      .withGraphFetched('socialmedia')
      .withGraphFetched('tags')
  },

  setProfileVisibility: async (_, { visibility }, { id, role }, info) => {
    if (!id) throw new AuthenticationError('not logged in')
    if (role !== 'mentor')
      throw new UserInputError(`can't set visibility of ${role} account`)
    await Mentor.query().patchAndFetchById(id, {
      listed: visibility === 'LISTED',
    })
    return await query(User, info).findById(id)
  },

  updateNotificationPreferences: async (
    _,
    { input: { receiveEmails, slotReminder } },
    { id, role }
  ) => {
    if (!id) throw new AuthenticationError('not logged in')
    if (slotReminder && role !== 'mentor')
      throw new UserInputError(`can't set slot reminder as ${role}`)

    const user = await User.query().upsertGraphAndFetch({
      id,
      ...(typeof receiveEmails === 'boolean' && {
        allow_emails: receiveEmails,
      }),
      // @ts-ignore
      ...(slotReminder && {
        mentors: {
          id,
          slot_reminder_email: slotReminder.toLowerCase(),
        },
      }),
    })

    return user
  },
}
