import query from '../utils/buildQuery'
import { User, Slots } from '../models'
import { signIn, checkPassword } from '../auth'
import { AuthenticationError, UserInputError, ForbiddenError } from '../error'
import uuidv4 from 'uuid/v4'
import { send } from '../email'

export default {
  signIn: async (_, { input: { email, password } }, { setHeader }, info) => {
    const [user] = await query(User, info, 'email', 'password').where({
      email,
    })
    const token = signIn(user, password)
    if (!token) throw new UserInputError('invalid credentials')
    setHeader(
      'Set-Cookie',
      `auth=${token}; HttpOnly; Max-Age=${60 ** 2 * 24 * 14}`
    )
    return user
  },

  signOut: (_, __, { uid, setHeader }) => {
    if (!uid) throw new AuthenticationError('not logged in')
    setHeader('Set-Cookie', 'auth=deleted; HttpOnly; Max-Age=-1')
  },

  updateProfile: async (_, { input }, { uid }, info) => {
    if (!uid) throw new AuthenticationError('not logged in')
    if ('tags' in input)
      input.tags = JSON.stringify(input.tags.map(text => ({ id: text, text })))
    return await query(User, info).patchAndFetchById(uid, input)
  },

  requestEmailChange() {},
  requestPasswordChange() {},

  deleteAccount: async (_, { password }, { uid, setHeader }) => {
    if (!uid) throw new AuthenticationError('not logged in')
    const user = await User.query()
      .select('uid', 'password')
      .findById(uid)
    if (!checkPassword(user, password))
      throw new ForbiddenError('wrong password')
    setHeader('Set-Cookie', 'auth=deleted; HttpOnly; Max-Age=-1')
    await User.query().deleteById(uid)
  },

  setProfileVisibility: async (_, { visibility }, { uid }, info) => {
    if (!uid) throw new AuthenticationError('not logged in')
    return await query(User, info).patchAndFetchById(uid, {
      newsfeed: visibility === 'LISTED' ? 'Y' : 'N',
    })
  },

  updateNotificationPreferences: async (
    _,
    { input: { receiveEmails, slotReminder } },
    { uid },
    info
  ) => {
    if (!uid) throw new AuthenticationError('not logged in')
    if (typeof receiveEmails === 'boolean') console.log(receiveEmails)
    return await query(User, info).patchAndFetchById(uid, {
      ...(typeof receiveEmails === 'boolean' && {
        emailNotifications: receiveEmails,
      }),
      ...(slotReminder && {
        availabilityReminder: slotReminder.toLowerCase(),
      }),
    })
  },

  updateSlots: async (
    _,
    { slots: { deleted = [], added = [] } },
    { uid },
    info
  ) => {
    if (!uid) throw new AuthenticationError('not logged in')
    const addList = added.map(({ start, duration = 30 }) => {
      return {
        sid: uuidv4(),
        mentorUID: uid,
        start,
        end: new Date(
          new Date(start).getTime() + duration * 60 * 1000
        ).toISOString(),
      }
    })
    await Promise.all([
      addList.length && Slots.knexQuery().insert(addList),
      deleted.length &&
        Slots.knexQuery()
          .whereIn('sid', deleted)
          .delete(),
    ])
    return await query(User, info).findById(uid)
  },

  messageExt: async (_, { input }) => {
    const receiver = await query(User, null, 'email', 'name').findById(input.to)
    if (!receiver?.email) throw new UserInputError('unknown receier')
    if (
      !new RegExp(User.jsonSchema.properties.email.pattern).test(
        input.fromEmail
      )
    )
      throw new UserInputError(`invalid email ${input.fromEmail}`)
    if (input.fromName.length < 3) throw new UserInputError(`invalid name`)
    if (input.message.length < 10)
      throw new UserInputError('must provide message')
    send(
      receiver,
      { name: input.fromName, email: input.fromEmail },
      input.message
    )
  },
}
