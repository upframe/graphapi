import query from '../../utils/buildQuery'
import { User } from '../../models'
import { UserInputError } from '../../error'
import { sendMessage } from '../../email'

export default {
  messageExt: async (_, { input }) => {
    const receiver = await query(User, null, 'email', 'name').findById(input.to)
    if (!receiver?.email) throw new UserInputError('unknown receier')
    if (!new RegExp(User.jsonSchema.properties.email.pattern).test(input.email))
      throw new UserInputError(`invalid email ${input.email}`)
    if (input.name.length < 3) throw new UserInputError(`invalid name`)
    if (input.message.length < 10)
      throw new UserInputError('must provide message')
    sendMessage(
      receiver,
      { name: input.name, email: input.email },
      input.message
    )
  },
}
