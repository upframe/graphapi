import { User } from '../../models'
import { UserInputError } from '../../error'
import { send } from '../../email'
import resolver from '../resolver'
import { system } from '../../authorization/user'
import uuidv4 from 'uuid/v4'
import logger from '../../logger'

export const messageExt = resolver()(
  async ({ query, args: { input }, ctx: { id } }) => {
    const receiver = await query
      .raw(User)
      .findById(input.to)
      .asUser(system)
    if (!receiver?.email) throw new UserInputError('unknown receiver')

    const { email, name, ...rest } = !id
      ? input
      : await query.raw(User).findById(id)

    const sender = id
      ? { email, name, ...rest }
      : (await query
          .raw(User)
          .where({ email })
          .first()
          .asUser(system)) ??
        (await query.raw(User).insertAndFetch({
          id: uuidv4(),
          email,
          name,
          role: 'nologin',
          handle: uuidv4(),
        }))

    if (
      !new RegExp(User.jsonSchema.properties.email.pattern).test(sender.email)
    )
      throw new UserInputError(`invalid email ${sender.email}`)
    if (sender.name.length < 3)
      throw new UserInputError(`invalid name ${sender.name}`)
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
