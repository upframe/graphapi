import resolver from '~/resolvers/resolver'
import { UserInputError, AuthenticationError } from '~/error'
import { cookie, signInToken } from '~/auth'
import * as M from '~/models'
import AuthUser, { system } from '~/authorization/user'
import MsgUser from '~/messaging/user'
import audit from '~/utils/audit'
import validate from '~/utils/validity'
import uuid from 'uuid/v4'
import { filterKeys } from '~/utils/object'
import axios from 'axios'
import { s3 } from '~/utils/aws'
import GoogleClient, { GoogleUserInfo } from '~/google/client'

export const signUp = resolver<any>()<{
  token: string
  passwordInput: PasswordSigninInput
  googleInput: GoogleSigninInput
}>(async ({ args: { token, ...input }, ctx, query, knex }) => {
  if (!token) throw new UserInputError('missing invite token')
  const invite = await query.raw(M.Invite).findById(token).asUser(system)
  if (!invite) throw new UserInputError('invalid invite token')

  let signup: Partial<ModelContent<M.Signup>> = {
    token,
  }
  let info: GoogleUserInfo

  if (input.googleInput) {
    const { code, redirect } = input.googleInput
    let client: GoogleClient
    try {
      client = await GoogleClient.fromAuthCode(code, redirect)
      logger.info('trace')
      info = await client.userInfo()
      if (!info?.id) throw Error('no id in google user info')

      if (
        await knex('users').where({ email: info.email?.toLowerCase() }).first()
      )
        throw new UserInputError(
          `the email associated with this Google account is already in use`
        )

      // allow reusing same google account from unfinished signup in multi-user invite
      await query
        .raw(M.ConnectGoogle)
        .delete()
        .where({ google_id: info.id, user_id: null })

      await client.persistLogin()
    } catch (error) {
      logger.error("couldn't get google signup info", { error, ...input })
      if (error instanceof UserInputError) throw error
      throw new AuthenticationError('failed to sign up with google')
    }

    const signIn = await query
      .raw(M.ConnectGoogle)
      .findById(info.id)
      .whereNotNull('user_id')
      .asUser(system)

    if (signIn) {
      logger.info('sign in instead of sign up', {
        user: signIn.user_id,
        google: info.id,
      })

      // sign in instead
      const user = await query({ entryName: 'Person' })
        .findById(signIn.user_id)
        .asUser(system)

      client.userId = signIn.user_id
      ctx.setHeader('Set-Cookie', cookie('auth', signInToken(user)))
      ctx.id = user.id
      return user
    }

    signup.google_id = info.id
    signup.email = info.email
  }

  signup = await query.raw(M.Signup).insertAndFetch(signup).asUser(system)

  logger.info({ signup })

  return {
    id: signup.id,
    email: signup.email,
    role: invite.role.toUpperCase(),
    authComplete: true,
    name: info?.name,
    picture: { url: info.picture },
    defaultPicture: {
      url: process.env.BUCKET_URL + 'default.png',
    },
  }
})

export const completeSignup = resolver<M.User>()(
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
    const signup = await query.raw(M.Signup).findById(signupId).asUser(system)
    if (!signup) throw new UserInputError('invalid signup token')

    const invite = await query.raw(M.Invite).findById(signup.token)

    let user: Partial<M.User> = {
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
      await query.raw(M.Mentor).insert(mentor).asUser(system)

      if (tags.length) {
        const existing = await query
          .raw(M.Tags)
          .whereRaw(
            `name ILIKE ANY (ARRAY[${tags.map(v => `'${v}'`).join(',')}])`
          )
          .asUser(system)

        const newTags = tags.filter(
          tag => !existing.find(({ name }) => name === tag)
        )

        const created = ((await query
          .raw(M.Tags)
          .insertAndFetch(newTags.map(name => ({ name })))
          .asUser(system)) as unknown) as M.Tags[]

        const userTags = [...existing, ...created].map(({ id }) => ({
          user_id: user.id,
          tag_id: id,
        }))

        await query.raw(M.UserTags).insert(userTags).asUser(system)
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
        .raw(M.SigninUpframe)
        .insert({
          user_id: user.id,
          email: signup.email,
          password: signup.password,
        })
        .asUser(system)
    }
    if (signup.google_id) {
      await query
        .raw(M.ConnectGoogle)
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
        audit.space(spaceInvite.space, 'join_space', {
          editor: user.id,
          ...spaceInvite,
        }),
        invite.email &&
          knex('space_invites').where({ id: signup.token }).delete(),
      ])
    }

    ctx.user = new AuthUser(user.id)

    const finalUser = await query().findById(user.id).asUser(system)

    await Promise.all([
      query.raw(M.Signup).deleteById(signup.id).asUser(system),
      invite.email &&
        query
          .raw(M.Invite)
          .findById(signup.token)
          .patch({ redeemed: finalUser.id })
          .asUser(system),
      !process.env.IS_OFFLINE &&
        new MsgUser(finalUser.id).wantsEmailNotifications(true),
    ])

    ctx.setHeader('Set-Cookie', cookie('auth', signInToken(finalUser)))
    ctx.id = finalUser.id

    return finalUser
  }
)
