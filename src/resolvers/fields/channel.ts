import resolver from '../resolver'
import Channel from '~/messaging/channel'
import type { Message } from '~/messaging/channel'
import { UserInputError } from 'apollo-server-lambda'

export const messages = resolver<Connection<Message>, any>()(
  async ({ parent, args: { first, last, after, before } }) => {
    const dir =
      last !== undefined || before !== undefined ? 'backward' : 'forward'

    if (
      dir === 'forward'
        ? last !== undefined || before !== undefined
        : first !== undefined || after !== undefined
    )
      throw new UserInputError(
        `${dir} pagination only expects expects arguments ${(dir === 'forward'
          ? ['first', 'after']
          : ['last', 'before']
        )
          .map(v => `'${v}'`)
          .join(' and ')}`
      )

    const { messages, hasNextPage } = await new Channel(parent.id).read(
      dir === 'forward'
        ? {
            first,
            after,
          }
        : {
            last,
            before,
          }
    )
    return {
      edges: messages.map(node => ({
        cursor: node.id,
        node,
      })),
      pageInfo: {
        hasNextPage,
        hasPreviousPage: after !== undefined || before !== undefined,
      },
    }
  }
)
