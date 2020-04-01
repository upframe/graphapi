import { User } from '../../models'
import { UserInputError } from '../../error'
import { sendMessage } from '../../email'
import resolver from '../resolver'
import { system } from '../../authorization/user'

export const messageExt = resolver()(
  async ({ query, args: { input }, ctx: { id } }) => {
    const receiver = await query
      .raw(User)
      .findById(input.to)
      .asUser(system)
    if (!receiver?.email) throw new UserInputError('unknown receiver')
    const sender = !id ? input : await query.raw(User).findById(id)
    if (
      !new RegExp(User.jsonSchema.properties.email.pattern).test(sender.email)
    )
      throw new UserInputError(`invalid email ${sender.email}`)
    if (sender.name.length < 3)
      throw new UserInputError(`invalid name ${sender.name}`)
    if (input.message.length < 10)
      throw new UserInputError('must provide message')

    sendMessage(receiver, sender, input.message)
  }
)
