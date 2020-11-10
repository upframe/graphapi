import resolver from '~/resolvers/resolver'
import GoogleClient, { GoogleUserInfo } from '~/google/client'
import { UserInputError, AuthenticationError } from '~/error'
import { checkPassword, cookie, signInToken } from '~/auth'
import * as M from '~/models'
import { system } from '~/authorization/user'

export const signIn = resolver<M.User>()<{
  passwordInput: PasswordSigninInput
  googleInput: GoogleSigninInput
}>(async ({ args: { passwordInput, googleInput }, ctx, query }) => {
  if (!!passwordInput === !!googleInput)
    throw new UserInputError(
      'must provide either password or google signin input'
    )

  const invalid = (): never => {
    throw new UserInputError('invalid credentials')
  }

  let userId: string

  if (passwordInput) {
    const creds = await query
      .raw(M.SigninUpframe)
      .findById(passwordInput.email)
      .asUser(system)

    if (
      !creds?.password ||
      !checkPassword(passwordInput.password, creds.password)
    )
      invalid()

    userId = creds.user_id
  } else {
    const { code, redirect } = googleInput
    let info: GoogleUserInfo
    let client: GoogleClient
    try {
      client = await GoogleClient.fromAuthCode(code, redirect)
      info = await client.userInfo()
      if (!info?.id) throw Error('no id in google user info')
    } catch (error) {
      logger.error("couldn't signin with google", { error, googleInput })
      throw new AuthenticationError('failed to sign in with google')
    }

    const data = await query
      .raw(M.ConnectGoogle)
      .findById(info.id)
      .asUser(system)

    if (!data?.user_id)
      throw new AuthenticationError(
        'there is no Upframe account connected to this Google account'
      )

    client.userId = data.user_id
    userId = data.user_id
  }

  const user = await query().findById(userId).asUser(system)

  ctx.setHeader('Set-Cookie', cookie('auth', signInToken(user)))
  ctx.id = user.id

  return user
})

export const signOut = resolver().loggedIn(({ ctx: { signOut } }) => signOut())
