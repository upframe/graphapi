import {
  User,
  Mentor,
  Tokens,
  ConnectGoogle,
  Signup,
  SigninUpframe,
  Invite,
  Tags,
  UserTags,
} from '../../models'
import { checkPassword, signInToken, cookie, hashPassword } from '../../auth'
import {
  UserInputError,
  ForbiddenError,
  InvalidGrantError,
  NotLoggedInError,
} from '../../error'
import resolver from '../resolver'
import { system } from '../../authorization/user'
import { send } from '../../email'
import genToken from '../../utils/token'
import { createClient } from '../../google'
import { google } from 'googleapis'
import validate from '../../utils/validity'
import uuid from 'uuid/v4'
import { filterKeys } from '../../utils/object'
import * as account from '../../account'
import { s3 } from '../../utils/aws'
import axios from 'axios'
import MsgUser from '~/messaging/user'
import AuthUser from '~/authorization/user'

export const signIn = resolver<User>()(
  async ({
    args: {
      input: { email, password },
    },
    ctx,
    query,
  }) => {
    const creds = await query.raw(SigninUpframe).findById(email).asUser(system)

    if (!creds?.password || !checkPassword(password, creds.password))
      throw new UserInputError('invalid credentials')

    const user = await query().findById(creds.user_id).asUser(system)

    ctx.setHeader('Set-Cookie', cookie('auth', signInToken(user)))
    ctx.id = user.id

    return user
  }
)

export const signInGoogle = resolver<User>()(
  async ({ args: { code, redirect }, query, ctx }) => {
    try {
      const client = createClient(redirect)
      const { tokens } = await client.getToken(code)
      client.setCredentials(tokens)
      const { data } = await google
        .oauth2({ auth: client, version: 'v2' })
        .userinfo.get()
      const signIn = await query
        .raw(ConnectGoogle)
        .findById(data.id)
        .asUser(system)
      if (!signIn) throw new UserInputError('invalid credentials')

      if (signIn.refresh_token !== tokens.refresh_token)
        await query
          .raw(ConnectGoogle)
          .findById(data.id)
          .patch({
            refresh_token: tokens.refresh_token,
            access_token: tokens.access_token,
          })
          .asUser(system)
      const user = await query().findById(signIn.user_id).asUser(system)
      ctx.setHeader('Set-Cookie', cookie('auth', signInToken(user)))
      ctx.id = user.id
      return user
    } catch (e) {
      if (e.message === 'invalid_grant') throw InvalidGrantError()
      throw e
    }
  }
)

export const signOut = resolver()(({ ctx }) => {
  if (!ctx.id) throw NotLoggedInError()
  ctx.setHeader('Set-Cookie', cookie('auth', 'deleted', -1))
  ctx.id = null
})

export const signUpPassword = resolver<any>()(
  async ({ args: { token, email, password }, query, knex }) => {
    const invite = await query.raw(Invite).findById(token).asUser(system)
    if (!invite) throw new UserInputError('invalid invite token')

    if (await query.raw(User).where({ email }).first())
      throw new UserInputError('email already in use')

    const validState = await validate.batch({ email, password }, knex)
    validState
      .filter(({ valid }) => !valid)
      .forEach(({ reason, field }) => {
        throw new UserInputError(`${field} ${reason}`)
      })

    const signup = await query
      .raw(Signup)
      .insertAndFetch({ token, email, password: hashPassword(password) })
      .asUser(system)

    return {
      id: signup.id,
      email,
      password,
      role: invite.role.toUpperCase(),
      authComplete: true,
      name: email
        .split('@')[0]
        .replace(/[^a-zA-Z]+/g, ' ')
        .toLowerCase()
        .trim()
        .replace(/(\s|^)[a-z]/g, v => v.toUpperCase()),
    }
  }
)

export const signUpGoogle = resolver<any>()(
  async ({ args: { token, code, redirect }, query, knex }) => {
    try {
      const invite = await query.raw(Invite).findById(token).asUser(system)
      if (!invite) throw new UserInputError('invalid invite token')

      const { info } = await account.connectGoogle(
        code,
        redirect,
        undefined,
        knex
      )

      const signup = await query
        .raw(Signup)
        .insertAndFetch({ token, google_id: info.id })
        .asUser(system)

      const picture = !info.picture?.endsWith('photo.jpg')
        ? info.picture
        : undefined

      return {
        id: signup.id,
        email: info.email,
        role: invite.role.toUpperCase(),
        authComplete: true,
        name: info.name,
        ...(picture && {
          picture: {
            url: picture,
          },
        }),
        defaultPicture: {
          url: process.env.BUCKET_URL + 'default.png',
        },
      }
    } catch (e) {
      if (e.message === 'invalid_grant') throw InvalidGrantError()
      throw e
    }
  }
)

export const connectGoogle = resolver<User>()(
  async ({ args: { redirect, code }, ctx: { id }, query, knex }) => {
    await account.connectGoogle(code, redirect, id, knex)
    logger.info('google account connected', { user: id })
    return await query().findById(id)
  }
)

export const disconnectGoogle = resolver<User>()(
  async ({ ctx: { id, user }, query }) => {
    const tokens = await query.raw(ConnectGoogle).where({ user_id: id }).first()
    if (!tokens) throw new UserInputError('google account not connected')
    if (!(await query.raw(SigninUpframe).findById(user.email).first()))
      throw new UserInputError('must first set account password')
    const client = createClient()
    client.setCredentials(tokens)

    await client.revokeToken(tokens.refresh_token)
    await query.raw(ConnectGoogle).deleteById(tokens.google_id)

    logger.info('google account disconnected', { user: id })

    return await query().findById(id)
  }
)

export const completeSignup = resolver<User>()(
  async ({
    args: {
      token: signupId,
      name,
      handle,
      biography,
      location,
      headline,
      photo,
      tags = [],
    },
    ctx,
    query,
    knex,
  }) => {
    const signup = await query.raw(Signup).findById(signupId).asUser(system)
    if (!signup) throw new UserInputError('invalid signup token')

    const invite = await query.raw(Invite).findById(signup.token)

    let user: Partial<User> = {
      id: uuid(),
      role: invite.role,
      name,
      handle,
      biography,
      location,
      allow_emails: true,
      headline,
      display_name: name.split(/[\s_.]/)[0],
    }

    if (signup.email) user.email = signup.email

    if (signup.google_id) {
      const client = createClient()
      client.setCredentials(
        await query.raw(ConnectGoogle).findById(signup.google_id).asUser(system)
      )
      const { data } = await google
        .oauth2({ auth: client, version: 'v2' })
        .userinfo.get()
      user.email = data.email
    }

    const validStatus = await validate.batch(
      {
        ...filterKeys(user, [
          'name',
          'handle',
          'biography',
          'location',
          'headline',
        ]),
      },
      knex
    )
    validStatus.forEach(({ valid, field, reason }) => {
      if (!valid) throw new UserInputError(`${field}: ${reason}`)
    })

    await query().insert(user)

    if (invite.role !== 'user') {
      const mentor = {
        id: user.id,
        listed: false,
      }
      await query.raw(Mentor).insert(mentor).asUser(system)

      if (tags.length) {
        const existing = await query
          .raw(Tags)
          .whereRaw(
            `name ILIKE ANY (ARRAY[${tags.map(v => `'${v}'`).join(',')}])`
          )
          .asUser(system)

        const newTags = tags.filter(
          tag => !existing.find(({ name }) => name === tag)
        )

        const created = ((await query
          .raw(Tags)
          .insertAndFetch(newTags.map(name => ({ name })))
          .asUser(system)) as unknown) as Tags[]

        const userTags = [...existing, ...created].map(({ id }) => ({
          user_id: user.id,
          tag_id: id,
        }))

        await query.raw(UserTags).insert(userTags).asUser(system)
      }
    }

    if (photo && photo !== process.env.BUCKET_URL + 'default.png') {
      try {
        let fileExt = 'png'
        const data = photo.startsWith('data:')
          ? new Buffer(photo.replace(/^data:image\/\w+;base64,/, ''), 'base64')
          : await axios
              .get(photo, { responseType: 'arraybuffer' })
              .then(({ data, headers }) => {
                const [type, ext] = headers['content-type']?.split('/') ?? []
                if (type !== 'image') throw new Error('not an image')
                fileExt = ext ?? fileExt
                return data
              })

        await s3
          .upload({
            Bucket: process.env.BUCKET_NAME,
            Key: `${user.id}.${fileExt}`,
            Body: data,
            ACL: 'public-read',
          })
          .promise()
      } catch (e) {
        console.warn(`couldn't upload photo for user ${user.id}`)
      }
    }

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

    const spaceInvite = await knex('space_invites')
      .where({ id: signup.token })
      .first()
    if (spaceInvite) {
      await Promise.all([
        knex('user_spaces').insert({
          user_id: user.id,
          space_id: spaceInvite.space,
          is_mentor: spaceInvite.mentor,
          is_owner: spaceInvite.owner,
        }),
        invite.email &&
          knex('space_invites').where({ id: signup.token }).delete(),
      ])
    }

    ctx.user = new AuthUser(user.id)

    const finalUser = await query().findById(user.id).asUser(system)

    await Promise.all([
      query.raw(Signup).deleteById(signup.id).asUser(system),
      invite.email &&
        query
          .raw(Invite)
          .findById(signup.token)
          .patch({ redeemed: finalUser.id })
          .asUser(system),
      new MsgUser(finalUser.id).wantsEmailNotifications(true),
    ])

    ctx.setHeader('Set-Cookie', cookie('auth', signInToken(finalUser)))
    ctx.id = finalUser.id

    return finalUser
  }
)

export const requestEmailChange = resolver()(
  async ({ args: { email }, ctx: { id }, query }) => {
    if (await query.raw(User).where({ email }).first())
      throw new UserInputError(`email ${email} already in use`)

    const token = genToken()

    await Promise.all([
      query
        .raw(Tokens)
        .insert({ token, scope: 'email', subject: id, payload: email })
        .asUser(system),
      send({ template: 'RESET_EMAIL', ctx: { token } }),
    ])
  }
)

export const changeEmail = resolver<User>()(
  async ({ args: { token: tokenId }, ctx: { id }, query }) => {
    const token = await query.raw(Tokens).findById(tokenId).asUser(system)
    if (token?.scope !== 'email') throw new UserInputError('invalid token')
    if (id && id !== token.subject)
      throw new UserInputError('please first logout of your current account')

    await Promise.allSettled([
      query.raw(Tokens).asUser(system).deleteById(tokenId),
      query
        .raw(User)
        .asUser(system)
        .findById(token.subject)
        .patch({ email: token.payload }),
      query
        .raw(SigninUpframe)
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
    const user = await query.raw(User).where({ email }).first().asUser(system)
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
      send({ template: 'RESET_PASSWORD', ctx: { token } }),
    ])
  }
)

export const changePassword = resolver<User>()(
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
      token = await query.raw(Tokens).findById(tokenId).asUser(system)
      if (token?.scope !== 'password') throw new UserInputError('invalid token')
      if (ctx.id && ctx.id !== token.subject)
        throw new UserInputError('must logout of current account first')
      await query.raw(Tokens).deleteById(tokenId).asUser(system)
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
      email && (await query.raw(SigninUpframe).findById(email).asUser(system))

    if (signin)
      await query
        .raw(SigninUpframe)
        .findById(email)
        .patch({ password: hashPassword(password) })
        .asUser(system)
    else
      await query.raw(SigninUpframe).insert({
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
    const user = await query.raw(User).findById(id)
    if (user.handle !== handle) throw new ForbiddenError('wrong username')
    await account.remove(id, query)
    setHeader('Set-Cookie', cookie('auth', 'deleted', -1))
  }
)
