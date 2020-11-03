import resolver from '../resolver'
import { User, Meetup } from '~/models'

export const mentor = resolver<User, any>()(
  async ({ parent: { mentor }, query }) =>
    await query({ entryName: 'Person' }).findById(mentor)
)

export const mentee = resolver<User, any>()(
  async ({ parent: { mentor, participants }, query }) =>
    await query({ entryName: 'Person' }).findById(
      participants.find(id => id !== mentor)
    )
)

export const location = resolver<string, any>()(
  ({ parent: { url } }) => url ?? ''
)

export const status = resolver<
  'CONFIRMED' | 'DECLINED' | 'PENDING' | 'EXPIRED',
  any
>()(async ({ parent, query }) => {
  const meetup = await query.raw(Meetup).findById(parent.id)
  if (!meetup) return 'EXPIRED'
  return meetup.status === 'confirmed'
    ? 'CONFIRMED'
    : meetup.status === 'cancelled'
    ? 'DECLINED'
    : 'PENDING'
})
