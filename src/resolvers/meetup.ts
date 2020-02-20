import query from '../utils/buildQuery'
import { User } from '../models'

export default {
  mentor: async ({ mentorUID, mentor }, _, __, info) =>
    mentor || (await query(User, info).findById(mentorUID)),

  mentee: async ({ menteeUID, mentee }, _, __, info) =>
    mentee || (await query(User, info).findById(menteeUID)),
}
