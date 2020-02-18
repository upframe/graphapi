import { User, Slots } from './models'
import { signIn, checkPassword } from './auth'
import {
  AuthenticationError,
  KeycodeError,
  UserInputError,
  ForbiddenError,
} from './error'
import query from './utils/buildQuery'
import uuidv4 from 'uuid/v4'

export default {
  Query: {
    mentors: async (_, __, ___, info) =>
      await query(User, info).where({
        type: 'mentor',
        newsfeed: 'Y',
      }),

    me: async (_, __, { uid }, info) => {
      if (!uid) throw new AuthenticationError('not logged in')
      return await query(User, info).findById(uid)
    },

    mentor: async (_, { keycode }, __, info) => {
      const [mentor] = await query(User, info).where({
        keycode,
      })
      if (!mentor) throw KeycodeError(`can't find mentor ${keycode}`)
      return mentor
    },
  },
  Mutation: {
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
        input.tags = JSON.stringify(
          input.tags.map(text => ({ id: text, text }))
        )
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
  },

  Person: {
    __resolveType({ type }) {
      if (type === 'user') return 'User'
      if (type === 'mentor') return 'Mentor'
    },

    _id: ({ keycode }) => keycode,

    profilePictures({ profilePictures, profilePic }) {
      return [
        ...(profilePictures
          ? Object.entries(profilePictures)
              .filter(([k, v]) => v && k.startsWith('pic'))
              .map(([k, v]) => {
                const [, size, type] =
                  k.match(/^pic([0-9]+|Max)(Jpeg|Webp)/) ?? []
                return {
                  ...(size && { size: parseInt(size, 10) || null }),
                  ...(type && { type: type.toLowerCase() }),
                  url: v,
                }
              })
          : []),
        ...(profilePic ? [{ url: profilePic }] : []),
      ]
    },

    social: obj =>
      Object.fromEntries(
        socialPlatforms.flatMap(name => (obj[name] ? [[name, obj[name]]] : []))
      ),
  },

  Mentor: {
    tags: obj => {
      try {
        return JSON.parse(obj.tags).map(({ text }) => text)
      } catch (e) {
        return []
      }
    },

    visibility: ({ newsfeed }) => (newsfeed === 'Y' ? 'LISTED' : 'UNLISTED'),

    notificationPrefs: ({ emailNotifications, availabilityReminder }) => ({
      ...(emailNotifications && {
        receiveEmails: emailNotifications.lastIndexOf(1) !== -1,
      }),
      slotReminder: availabilityReminder?.toUpperCase(),
    }),

    slots: ({ timeSlots }) => {
      return (timeSlots ?? []).map(({ sid, start, end }) => ({
        id: sid,
        start,
        duration: !end
          ? 30
          : (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60),
      }))
    },
  },
}

const socialPlatforms = [
  'dribbble',
  'facebook',
  'github',
  'linkedin',
  'twitter',
]
