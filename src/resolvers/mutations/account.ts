import {
  User,
  Mentor,
  Tokens,
  ConnectGoogle,
  Signup,
  SigninUpframe,
  Invite,
} from '../../models'
import { checkPassword, signInToken, cookie, hashPassword } from '../../auth'
import {
  AuthenticationError,
  UserInputError,
  ForbiddenError,
  InvalidGrantError,
} from '../../error'
import resolver from '../resolver'
import { system } from '../../authorization/user'
import { sendMJML } from '../../email'
import genToken from '../../utils/token'
import { createClient } from '../../google'
import { google } from 'googleapis'
import validate from '../../utils/validity'
import uuid from 'uuid/v4'
import { filterKeys } from '../../utils/object'

export const signIn = resolver<User>()(
  async ({
    args: {
      input: { email, password },
    },
    ctx,
    query,
  }) => {
    const creds = await query
      .raw(SigninUpframe)
      .findById(email)
      .asUser(system)

    if (!checkPassword(password, creds.password))
      throw new UserInputError('invalid credentials')

    const user = await query()
      .findById(creds.user_id)
      .asUser(system)

    ctx.setHeader('Set-Cookie', cookie('auth', signInToken(user)))
    ctx.id = user.id

    return user
  }
)

export const signOut = resolver()(({ ctx }) => {
  if (!ctx.id) throw new AuthenticationError('not logged in')
  ctx.setHeader('Set-Cookie', cookie('auth', 'deleted', -1))
  ctx.id = null
})

export const signUpGoogle = resolver<any>()(
  async ({ args: { token, code, redirect }, query }) => {
    try {
      const invite = await query
        .raw(Invite)
        .findById(token)
        .asUser(system)
      if (!invite) throw new UserInputError('invalid invite token')

      const client = createClient(redirect)
      const { tokens } = await client.getToken(code)
      client.setCredentials(tokens)
      const { data } = await google
        .oauth2({ auth: client, version: 'v2' })
        .userinfo.get()

      if (
        (
          await Promise.all([
            query
              .raw(User)
              .where({ email: data.email })
              .asUser(system)
              .first(),
            query
              .raw(ConnectGoogle)
              .where({ google_id: data.id })
              .asUser(system)
              .first(),
          ])
        ).some(Boolean)
      )
        throw new UserInputError(`email "${data.email}" already in use`)

      await query
        .raw(ConnectGoogle)
        .insert({
          google_id: data.id,
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          scopes: ((tokens as any).scope ?? '').split(' '),
        })
        .asUser(system)

      await query
        .raw(Signup)
        .insert({ token, google_id: data.id })
        .asUser(system)

      return {
        id: token,
        email: data.email,
        role: invite.role.toUpperCase(),
        authComplete: true,
        name: data.name,
      }
    } catch (e) {
      if (e.message === 'invalid_grant') throw InvalidGrantError()
      throw e
    }
  }
)

export const completeSignup = resolver<User>()(
  async ({ args: { token, name, handle, biography }, ctx, query }) => {
    const signup = await query
      .raw(Signup)
      .findById(token)
      .asUser(system)
    if (!signup) throw new UserInputError('invalid signup token')

    let user: Partial<User> = {
      id: uuid(),
      role: (await query.raw(Invite).findById(token)).role,
      name,
      handle,
      biography,
      allow_emails: true,
    }

    if (signup.email) user.email = signup.email

    if (signup.google_id) {
      const client = createClient()
      client.setCredentials(
        await query
          .raw(ConnectGoogle)
          .findById(signup.google_id)
          .asUser(system)
      )
      const { data } = await google
        .oauth2({ auth: client, version: 'v2' })
        .userinfo.get()
      user.email = data.email
    }

    const validStatus = await validate.batch(
      filterKeys(user, ['name', 'handle', 'biography'])
    )
    validStatus.forEach(({ valid, field, reason }) => {
      if (!valid) throw new UserInputError(`${field}: ${reason}`)
    })

    await query().insert(user)

    if (signup.password) {
      await query
        .raw(SigninUpframe)
        .insert({
          user_id: user.id,
          email: signup.email,
          password: signup.password,
        })
        .asUser(system)
    }
    if (signup.google_id) {
      await query
        .raw(ConnectGoogle)
        .findById(signup.google_id)
        .patch({ user_id: user.id })
        .asUser(system)
    }

    const finalUser = await query()
      .findById(user.id)
      .asUser(system)

    await Promise.all([
      query
        .raw(Signup)
        .deleteById(signup.token)
        .asUser(system),
      query
        .raw(Invite)
        .findById(signup.token)
        .patch({ redeemed: finalUser.id })
        .asUser(system),
    ])

    ctx.setHeader('Set-Cookie', cookie('auth', signInToken(finalUser)))
    ctx.id = finalUser.id

    return finalUser
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
      .raw(SigninUpframe)
      .where({ user_id: token?.subject ?? ctx.id })
      .patch({ password: hashPassword(password) })

    const user = await query()
      .findById(token?.subject ?? ctx.id)
      .asUser(system)
    if (token?.subject !== ctx.id) {
      ctx.setHeader('Set-Cookie', cookie('auth', signInToken(user)))
      ctx.id = user.id
    }
    return user
  }
)

export const deleteAccount = resolver().loggedIn(
  async ({ args: { handle }, ctx: { id, setHeader }, query }) => {
    const user = await query.raw(User).findById(id)
    if (user.handle !== handle) throw new ForbiddenError('wrong username')
    await query.raw(User).deleteById(id)
    setHeader('Set-Cookie', cookie('auth', 'deleted', -1))
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
