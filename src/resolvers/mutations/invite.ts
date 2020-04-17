import resolver from '../resolver'
import { User, Invite } from '../../models'
import { ForbiddenError } from 'apollo-server-lambda'
import { sendMJML } from '../../email'
import genToken from '../../utils/token'

export const invite = resolver<User>().loggedIn(
  async ({ args: { emails, role }, ctx: { id, user }, query }) => {
    if (role === 'MENTOR' && !user.groups.includes('mentor'))
      throw new ForbiddenError('not allowed to invite as mentor')
    if (!['USER', 'MENTOR'].includes(role))
      throw new ForbiddenError('can only invite as user or mentor')

    const invites = ((await query.raw(Invite).insertAndFetch(
      emails.map(email => ({
        id: genToken(),
        issuer: id,
        email,
        role: role.toLowerCase(),
      }))
    )) as unknown) as Invite[]

    const issuer = await query().findById(id)
    invites.forEach(({ id, email }) =>
      sendMJML({
        template: 'invite',
        ctx: {
          name: issuer.name,
          handle: issuer.handle,
          mentor: role === 'MENTOR',
          token: id,
        },
        to: { email },
        subject: 'Invitation to join Upframe',
      })
    )
    return issuer
  }
)
