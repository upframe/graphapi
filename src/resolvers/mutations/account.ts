import query from '../../utils/buildQuery'
import { User } from '../../models'
import * as auth from '../../auth'
import {
  AuthenticationError,
  UserInputError,
  ForbiddenError,
} from '../../error'
import uuidv4 from 'uuid/v4'

export const signIn = async (_, { input: { email, password } }, ctx, info) => {
  const [user] = await query<User>(info).where({
    email,
  })
  const token = auth.signIn(user, password)
  if (!token) throw new UserInputError('invalid credentials')
  ctx.setHeader('Set-Cookie', auth.cookie('auth', token))
  ctx.id = user.id
  return user
}

export const signOut = (_, __, ctx) => {
  if (!ctx.id) throw new AuthenticationError('not logged in')
  ctx.setHeader('Set-Cookie', auth.cookie('auth', 'deleted', -1))
  ctx.id = null
}

export const createAccount = async (
  _,
  { input: { name, email, password } },
  ctx
) => {
  let existing = await User.query()
    .where({
      email,
    })
    .orWhere({ name })
    .first()
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
    password: auth.hashPassword(password),
    role: 'user',
  })
  ctx.setHeader('Set-Cookie', auth.cookie('auth', auth.signIn(user, password)))
  ctx.id = user.id
  return user
}

export const requestEmailChange = () => {}
export const requestPasswordChange = () => {}

export const deleteAccount = async (_, { password }, { id, setHeader }) => {
  if (!id) throw new AuthenticationError('not logged in')
  const user = await User.query()
    .select('id', 'password')
    .findById(id)
  if (!auth.checkPassword(user, password))
    throw new ForbiddenError('wrong password')
  setHeader('Set-Cookie', auth.cookie('auth', 'deleted', -1))
  await User.query().deleteById(id)
}
