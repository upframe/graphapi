import resolver from '../resolver'
import { User, Invite } from '../../models'
import { ForbiddenError, UserInputError } from 'apollo-server-lambda'
import { send } from '../../email'
import genToken from '../../utils/token'
import { system } from '../../authorization/user'

export const invite = resolver<User>().isMentor(
  async ({ args: { emails, role }, ctx: { id, user }, query }) => {
    if (role === 'MENTOR' && !user.groups.includes('mentor'))
      throw new ForbiddenError('not allowed to invite as mentor')
    if (!['USER', 'MENTOR'].includes(role))
      throw new ForbiddenError('can only invite as user or mentor')

    const exists = await query().whereIn('email', emails).asUser(system)
    if (exists.length)
      throw new UserInputError(
        `${exists.map(({ email }) => email).join(', ')} is already a user`
      )

    const invites = ((await query.raw(Invite).insertAndFetch(
      emails.map(email => ({
        id: genToken(),
        issuer: id,
        email,
        role: role.toLowerCase(),
      }))
    )) as unknown) as Invite[]

    const issuer = await query().findById(id)
    await Promise.all(
      invites.map(({ id }) =>
        send({
          template: 'INVITE',
          ctx: {
            invite: id,
          },
        })
      )
    )

    emails.forEach(email =>
      logger.info('invitation issued', { issuer: issuer.id, to: email, role })
    )
    return issuer
  }
)
