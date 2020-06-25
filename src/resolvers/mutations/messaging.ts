import { User } from '../../models'
import { UserInputError } from '../../error'
import { send } from '../../email'
import resolver from '../resolver'
import { system } from '../../authorization/user'
import logger from '../../logger'

export const messageExt = resolver().loggedIn(
  async ({ query, args: { input }, ctx: { id } }) => {
    const receiver = await query.raw(User).findById(input.to).asUser(system)
    if (!receiver?.email) throw new UserInputError('unknown receiver')

    const sender = await query.raw(User).findById(id)

    if (input.message.length < 10)
      throw new UserInputError('must provide message')

    await send({
      template: 'MESSAGE',
      ctx: { sender: sender.id, receiver: receiver.id, message: input.message },
    })

    logger.info('email message sent', {
      from: sender.id,
      receiver: receiver.id,
      input,
    })
  }
)
