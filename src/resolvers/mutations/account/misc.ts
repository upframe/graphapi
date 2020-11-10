import resolver from '~/resolvers/resolver'
import * as M from '~/models'
import { signInToken, cookie, hashPassword } from '~/auth'
import { UserInputError, ForbiddenError } from '~/error'
import { system } from '~/authorization/user'
import { send } from '~/email'
import genToken from '~/utils/token'
import GoogleClient from '~/google/client'

export const requestEmailChange = resolver()(
  async ({ args: { email }, ctx: { id }, query }) => {
    if (await query.raw(M.User).where({ email }).first())
      throw new UserInputError(`email ${email} already in use`)

    const token = genToken()

    await Promise.all([
      query
        .raw(M.Tokens)
        .insert({ token, scope: 'email', subject: id, payload: email })
        .asUser(system),
      send({ template: 'RESET_EMAIL', ctx: { token } }),
    ])
  }
)

export const changeEmail = resolver<M.User>()(
  async ({ args: { token: tokenId }, ctx: { id }, query }) => {
    const token = await query.raw(M.Tokens).findById(tokenId).asUser(system)
    if (token?.scope !== 'email') throw new UserInputError('invalid token')
    if (id && id !== token.subject)
      throw new UserInputError('please first logout of your current account')

    await Promise.allSettled([
      query.raw(M.Tokens).asUser(system).deleteById(tokenId),
      query
        .raw(M.User)
        .asUser(system)
        .findById(token.subject)
        .patch({ email: token.payload }),
      query
        .raw(M.SigninUpframe)
        .asUser(system)
        .where({ user_id: token.subject })
        .patch({ email: token.payload }),
    ])

    if (id !== token.subject) return null
    return await query().findById(id)
  }
)

export const requestPasswordChange = resolver()(
  async ({ args: { email }, query }) => {
    const user = await query.raw(M.User).where({ email }).first().asUser(system)
    if (!user?.email)
      return void (await new Promise(res =>
        setTimeout(res, 500 + Math.random() * 1000)
      ))

    const token = genToken()

    await Promise.all([
      query
        .raw(M.Tokens)
        .insert({ token, scope: 'password', subject: user.id })
        .asUser(system),
      send({ template: 'RESET_PASSWORD', ctx: { token } }),
    ])
  }
)

export const changePassword = resolver<M.User>()(
  async ({
    args: { password },
    ctx,
    query,
    knex,
    args: { token: tokenId },
  }) => {
    if (!ctx.id && !tokenId)
      throw new UserInputError('must be logged in or provide token')
    if (password.length < 8) throw new UserInputError('invalid password')

    let token
    if (tokenId) {
      token = await query.raw(M.Tokens).findById(tokenId).asUser(system)
      if (token?.scope !== 'password') throw new UserInputError('invalid token')
      if (ctx.id && ctx.id !== token.subject)
        throw new UserInputError('must logout of current account first')
      await query.raw(M.Tokens).deleteById(tokenId).asUser(system)
    }

    const email =
      ctx.user.email ??
      (token &&
        (
          await knex('users')
            .select('email')
            .where({ id: token.subject })
            .first()
        ).email)

    const signin =
      email && (await query.raw(M.SigninUpframe).findById(email).asUser(system))

    if (signin)
      await query
        .raw(M.SigninUpframe)
        .findById(email)
        .patch({ password: hashPassword(password) })
        .asUser(system)
    else
      await query.raw(M.SigninUpframe).insert({
        email,
        password: hashPassword(password),
        user_id: token?.subject ?? ctx.id,
      })

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
    logger.info('delete account', { id })
    const user = await query.raw(M.User).findById(id)
    if (user.handle !== handle) throw new ForbiddenError('wrong username')
    await (await GoogleClient.fromUserId(id)).revoke()
    await query.raw(M.User).deleteById(id).asUser(system)
    setHeader('Set-Cookie', cookie('auth', 'deleted', -1))
  }
)
