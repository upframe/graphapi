import { SchemaDirectiveVisitor, ForbiddenError } from 'apollo-server-lambda'
import { defaultFieldResolver } from 'graphql'

export default class PrivateDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field
    field.resolve = async function(...args) {
      const [parent, , ctx] = args
      if (!ctx.uid || parent.uid !== ctx.uid)
        throw new ForbiddenError('PRIVATE')
      return await resolve.apply(this, args)
    }
  }
}
