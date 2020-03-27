import { User } from '../../models'
import * as auth from '../../auth'
import {
  AuthenticationError,
  UserInputError,
  ForbiddenError,
} from '../../error'
import uuidv4 from 'uuid/v4'
import resolver from '../resolver'
import { system } from '../../authorization/user'

export const signIn = resolver<User>()(
  async ({
    args: {
      input: { email, password },
    },
    ctx,
    query,
  }) => {
    const user = await query()
      .where({ email })
      .first()
      .asUser(system)
    const token = auth.signIn(user, password)
    if (!token) throw new UserInputError('invalid credentials')
    ctx.setHeader('Set-Cookie', auth.cookie('auth', token))
    ctx.id = user.id
    return user
  }
)

export const signOut = resolver()(({ ctx }) => {
  if (!ctx.id) throw new AuthenticationError('not logged in')
  ctx.setHeader('Set-Cookie', auth.cookie('auth', 'deleted', -1))
  ctx.id = null
})

export const createAccount = resolver<User>()(
  async ({
    args: {
      input: { email, name, password },
    },
    query,
    ctx,
  }) => {
    const existing = await query()
      .where({ email })
      .first()

    if (existing?.role === 'nologin')
      await query()
        .where({ email })
        .delete()
        .asUser(system)
    else if (existing) throw new ForbiddenError(`email already in use`)

    let handle = name.toLowerCase().replace(/[^\w]+/g, '.')
    if (
      await User.query()
        .where({ handle })
        .first()
    )
      handle = uuidv4()

    const user = await query().insertAndFetch({
      id: uuidv4(),
      handle,
      name,
      email,
      password: auth.hashPassword(password),
      role: 'user',
    })

    ctx.setHeader(
      'Set-Cookie',
      auth.cookie('auth', auth.signIn(user, password))
    )
    ctx.id = user.id
    return user
  }
)

export const requestEmailChange = resolver()(() => {})
export const requestPasswordChange = resolver()(() => {})

export const deleteAccount = resolver().loggedIn(
  async ({ args: { password }, ctx: { id, setHeader }, query }) => {
    const user = await query.raw(User).findById(id)
    if (!auth.checkPassword(user, password))
      throw new ForbiddenError('wrong password')
    await query.raw(User).deleteById(id)
    setHeader('Set-Cookie', auth.cookie('auth', 'deleted', -1))
  }
)
