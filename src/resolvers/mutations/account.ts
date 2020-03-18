import query from '../../utils/buildQuery'
import { User } from '../../models'
import { signIn, checkPassword, hashPassword } from '../../auth'
import {
  AuthenticationError,
  UserInputError,
  ForbiddenError,
} from '../../error'
import uuidv4 from 'uuid/v4'

export default {
  signIn: async (_, { input: { email, password } }, ctx, info) => {
    const [user] = await query(User, info, 'email', 'password').where({
      email,
    })
    const token = signIn(user, password)
    if (!token) throw new UserInputError('invalid credentials')
    ctx.setHeader(
      'Set-Cookie',
      `auth=${token}; HttpOnly; SameSite=Strict; Secure; Max-Age=${60 ** 2 *
        24 *
        14}`
    )
    ctx.id = user.id
    return user
  },

  signOut: (_, __, ctx) => {
    if (!ctx.id) throw new AuthenticationError('not logged in')
    ctx.setHeader(
      'Set-Cookie',
      'auth=deleted; HttpOnly; SameSite=Strict; Secure; Max-Age=-1'
    )
    ctx.id = null
  },

  createAccount: async (_, { input: { name, email, password } }, ctx) => {
    let existing = await User.query()
      .where({
        email,
      })
      .orWhere({ name })
      .first()
    console.log(existing)
    if (existing?.email === email && existing.role === 'nologin') {
      await User.query()
        .where({ email })
        .delete()
      existing = null
    }
    if (existing) {
      throw new UserInputError(
        `user with ${
          existing.email === email ? `email "${email}"` : `name "${name}"`
        } already exists`
      )
    }

    let handle = name.toLowerCase().replace(/[^\w]+/g, '.')
    if (
      await User.query()
        .where({ handle })
        .first()
    )
      handle = uuidv4()

    const user = await User.query().insertAndFetch({
      id: uuidv4(),
      handle,
      name,
      email,
      password: hashPassword(password),
      role: 'user',
    })
    ctx.setHeader(
      'Set-Cookie',
      `auth=${signIn(
        user,
        password
      )}; HttpOnly; SameSite=Strict; Secure; Max-Age=${60 ** 2 * 24 * 14}`
    )
    ctx.id = user.id
    return user
  },

  requestEmailChange() {},
  requestPasswordChange() {},

  deleteAccount: async (_, { password }, { id, setHeader }) => {
    if (!id) throw new AuthenticationError('not logged in')
    const user = await User.query()
      .select('id', 'password')
      .findById(id)
    if (!checkPassword(user, password))
      throw new ForbiddenError('wrong password')
    setHeader('Set-Cookie', 'auth=deleted; HttpOnly; Max-Age=-1')
    await User.query().deleteById(id)
  },
}
