import { sns } from './aws'
import type { User } from '~/models'
import _knex from '~/db'

export const refresh = async (query: string, variables: object = {}) => {
  if (process.env.IS_OFFLINE)
    return logger.info(`refresh ${query} ${JSON.stringify(variables)}`)
  try {
    await sns
      .publish({
        Message: JSON.stringify({
          action: 'REFRESH_QUERY',
          query,
          variables,
        }),
        TopicArn: process.env.CACHE_SNS_ARN,
      })
      .promise()
  } catch (error) {
    logger.error("couldn't dispatch cache refresh", {
      query,
      variables,
    })
    throw error
  }
}

export const userUpdated = async (
  user: Partial<User>,
  knex: ReturnType<typeof _knex>,
  listedUpdate = false
) => {
  if (!user.id || user.role === 'user') return

  const updates = []

  if (
    listedUpdate ||
    (
      user.mentors ??
      (await knex('mentors').where('id', user.id).select('listed').first())
    ).listed
  )
    updates.push(refresh('Mentors'))

  if (!listedUpdate)
    updates.push(
      ...(
        await knex('user_lists')
          .where('user_id', '=', user.id)
          .leftJoin('lists', 'lists.id', 'user_lists.list_id')
      ).map(({ name }) => refresh('UserList', { name }))
    )

  await Promise.all(updates)
}

export const listUpdated = async (name: string) => {
  await refresh('UserList', { name })
}
