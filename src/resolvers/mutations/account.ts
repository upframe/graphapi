import query from '../../utils/buildQuery'
import { User } from '../../models'
import { signIn, checkPassword } from '../../auth'
import {
  AuthenticationError,
  UserInputError,
  ForbiddenError,
} from '../../error'

export default {
  signIn: async (_, { input: { email, password } }, ctx, info) => {
    const [user] = await query(User, info, 'email', 'password').where({
      email,
    })
    const token = signIn(user, password)
    if (!token) throw new UserInputError('invalid credentials')
    ctx.setHeader(
      'Set-Cookie',
      `auth=${token}; HttpOnly; Max-Age=${60 ** 2 * 24 * 14}`
    )
    ctx.id = user.id
    return user
  },

  signOut: (_, __, ctx) => {
    if (!ctx.id) throw new AuthenticationError('not logged in')
    ctx.setHeader('Set-Cookie', 'auth=deleted; HttpOnly; Max-Age=-1')
    ctx.id = null
  },

  createAccount: async (
    _,
    { input: { devPass, name, email, password } },
    ctx
  ) => {
    // if (devPass !== process.env.DEV_PASSWORD)
    //   throw new ForbiddenError('incorrect dev password')
    // const [existing] = await User.query()
    //   .where({ email })
    //   .orWhere({ name })
    // if (existing)
    //   throw new UserInputError(
    //     `user with ${
    //       existing.email === email ? `email "${email}"` : `name "${name}"`
    //     } already exists`
    //   )
    // password = hashPassword(password)
    // const user = await User.query().insertAndFetch({
    //   id: uuidv4(),
    //   name,
    //   email,
    //   password,
    //   type: 'mentor',
    //   newsfeed: 'N',
    //   handle: name.toLowerCase().replace(/\s/g, '.'),
    // })
    // ctx.setHeader(
    //   'Set-Cookie',
    //   `auth=${signIn(user, password)}; HttpOnly; Max-Age=${60 ** 2 * 24 * 14}`
    // )
    // ctx.id = user.id
    // return user
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
