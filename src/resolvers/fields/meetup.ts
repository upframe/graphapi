import resolver from '../resolver'

export const mentor = resolver<any, any>()(
  async ({ parent: { mentorUID, mentor }, query }) =>
    mentor ?? (await query().findById(mentorUID))
)

export const mentee = resolver<any, any>()(
  async ({ parent: { menteeUID, mentee }, query }) =>
    mentee ?? (await query().findById(menteeUID))
)
