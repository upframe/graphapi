import { User, Mentor, Tokens } from '../../models'
import * as auth from '../../auth'
import {
  AuthenticationError,
  UserInputError,
  ForbiddenError,
} from '../../error'
import uuidv4 from 'uuid/v4'
import resolver from '../resolver'
import { system } from '../../authorization/user'
import { sendMJML } from '../../email'
import genToken from '../../utils/token'

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

export const requestEmailChange = resolver()(
  async ({ args: { email }, ctx: { id }, query }) => {
    if (
      await query
        .raw(User)
        .where({ email })
        .first()
    )
      throw new UserInputError(`email ${email} already in use`)

    const token = genToken()

    const user = await query.raw(User).findById(id)

    await Promise.all([
      query
        .raw(Tokens)
        .insert({ token, scope: 'email', subject: id, payload: email })
        .asUser(system),
      sendMJML({
        template: 'reset-email',
        ctx: { name: user.name, handle: user.handle, token },
        to: { ...user, email } as User,
        subject: 'Change of Email',
      }),
    ])
  }
)

export const changeEmail = resolver<User>()(
  async ({ args: { token: tokenId }, ctx: { id }, query }) => {
    const token = await query
      .raw(Tokens)
      .findById(tokenId)
      .asUser(system)
    if (token?.scope !== 'email') throw new UserInputError('invalid token')
    if (id && id !== token.subject)
      throw new UserInputError('please first logout of your current account')

    await Promise.all([
      query
        .raw(Tokens)
        .asUser(system)
        .deleteById(tokenId),
      query
        .raw(User)
        .asUser(system)
        .findById(token.subject)
        .patch({ email: token.payload }),
    ])

    if (id !== token.subject) return null
    return await query().findById(id)
  }
)

export const requestPasswordChange = resolver()(
  async ({ args: { email }, query }) => {
    const user = await query
      .raw(User)
      .where({ email })
      .first()
      .asUser(system)
    if (!user?.email)
      return void (await new Promise(res =>
        setTimeout(res, 500 + Math.random() * 1000)
      ))

    const token = genToken()

    await Promise.all([
      query
        .raw(Tokens)
        .insert({ token, scope: 'password', subject: user.id })
        .asUser(system),
      sendMJML({
        template: 'reset-password',
        ctx: { name: user.name.split(' ')[0], token },
        to: user,
        subject: 'Password Reset',
      }),
    ])
  }
)

export const changePassword = resolver<User>()(
  async ({ args: { password }, ctx, query, args: { token: tokenId } }) => {
    if (!ctx.id && !tokenId)
      throw new UserInputError('must be logged in or provide token')
    if (password.length < 8) throw new UserInputError('invalid password')

    let token
    if (tokenId) {
      token = await query
        .raw(Tokens)
        .findById(tokenId)
        .asUser(system)
      if (token?.scope !== 'password') throw new UserInputError('invalid token')
      if (ctx.id && ctx.id !== token.subject)
        throw new UserInputError('must logout of current account first')
      await query
        .raw(Tokens)
        .deleteById(tokenId)
        .asUser(system)
    }
    await query
      .raw(User)
      .findById(token?.subject ?? ctx.id)
      .patch({ password: auth.hashPassword(password) })
      .asUser(system)

    const user = await query()
      .findById(token?.subject ?? ctx.id)
      .asUser(system)
    if (token?.subject !== ctx.id) {
      ctx.setHeader(
        'Set-Cookie',
        auth.cookie('auth', auth.signIn(user, null, true))
      )
      ctx.id = user.id
    }
    return user
  }
)

export const deleteAccount = resolver().loggedIn(
  async ({ args: { password }, ctx: { id, setHeader }, query }) => {
    const user = await query.raw(User).findById(id)
    if (!auth.checkPassword(user, password))
      throw new ForbiddenError('wrong password')
    await query.raw(User).deleteById(id)
    setHeader('Set-Cookie', auth.cookie('auth', 'deleted', -1))
  }
)

export const setUserRole = resolver<User>().isAdmin(
  async ({ args: { userId, role }, query }) => {
    const user = await query.raw(User).findById(userId)
    if (!user) throw new UserInputError(`unknown user ${userId}`)
    role = role.toLowerCase()
    if (user.role === role)
      throw new UserInputError(`user ${user.name} already has role ${role}`)
    if (role === 'nologin')
      throw new UserInputError("can't set role to NOLOGIN")

    if (
      ['mentor', 'admin'].includes(role) &&
      !['mentor', 'admin'].includes(user.role)
    )
      await query.raw(Mentor).insert({ id: userId, listed: false })
    else if (role === 'user' && ['mentor', 'admin'].includes(user.role))
      await query.raw(Mentor).deleteById(userId)

    await query
      .raw(User)
      .findById(userId)
      .patch({ role })

    return query().findById(userId)
  }
)
