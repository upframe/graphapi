import query from '../../utils/buildQuery'
import { User } from '../../models'
import { UserInputError } from '../../error'
import { sendMessage } from '../../email'

export default {
  messageExt: async (_, { input }, { id }) => {
    const receiver = await User.query().findById(input.to)
    if (!receiver?.email) throw new UserInputError('unknown receier')

    let { email, name } = !id ? input : await User.query().findById(id)

    if (!new RegExp(User.jsonSchema.properties.email.pattern).test(email))
      throw new UserInputError(`invalid email ${email}`)
    if (name.length < 3) throw new UserInputError(`invalid name ${name}`)
    if (input.message.length < 10)
      throw new UserInputError('must provide message')

    sendMessage(receiver, { name, email }, input.message)
  },
}
