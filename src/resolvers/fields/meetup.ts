import query from '../../utils/buildQuery'

export default {
  mentor: async ({ mentorUID, mentor }, _, __, info) =>
    mentor || (await query(info).findById(mentorUID)),

  mentee: async ({ menteeUID, mentee }, _, __, info) =>
    mentee || (await query(info).findById(menteeUID)),
}
