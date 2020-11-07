import { google } from 'googleapis'
import { googleOAuthScopes, GoogleOAuthScope } from './scopes'

export const oAuth2Client = (redirectURI?: string) =>
  new google.auth.OAuth2(
    process.env.OAUTH_CLIENT_ID,
    process.env.OAUTH_CLIENT_SECRET,
    redirectURI
  )

export function generateAuthUrl(
  redirect: string,
  ...scopes: GoogleOAuthScope[]
): string {
  if (!scopes.includes('signIn')) scopes.push('signIn')

  const scopeUrls = scopes.flatMap(scope => googleOAuthScopes[scope])

  logger.debug(`generate oauth url with scopes`, scopeUrls, { redirect })

  const url = oAuth2Client(redirect).generateAuthUrl({
    access_type: 'offline',
    scope: scopeUrls,
    include_granted_scopes: true,
  })

  return url
}

export async function getTokensFromAuthCode(code: string, redirect: string) {
  const { tokens } = await oAuth2Client(redirect).getToken(code)
  return tokens
}

export type Credentials = PromType<ReturnType<typeof getTokensFromAuthCode>>
