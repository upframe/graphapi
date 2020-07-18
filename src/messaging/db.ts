import { ddb } from '~/utils/aws'
import {
  get,
  put,
  batchRead,
  batchWrite,
  batchDelete,
  query,
  tables,
  remove,
  update,
} from './dbOps'

type Conversation = {
  id: tables['conversations']['pk']
  channels: string[]
  participants: string[]
}

export const prefix = {
  conversation: (id = '') => `CONV|${id}`,
  channel: (id = '') => `CHANNEL|${id}`,
  user: (id = '') => `USER|${id}`,
  client: (id = '') => `CLIENT|${id}`,
  message: (id = '') => `MSG|${id}`,
}

export const getConversation = async (id: string) =>
  await get('conversations', { pk: prefix.conversation(id), sk: 'meta' })

export const getConversations = async (ids: string[]) =>
  await batchRead(
    'conversations',
    ids.map(id => ({ pk: prefix.conversation(id), sk: 'meta' }))
  )

export const getUser = async (id: string) =>
  await get('connections', { pk: prefix.user(id), sk: 'meta' })

export const createUser = async (id: string) => {
  try {
    await put(
      'connections',
      { key: { pk: prefix.user(id), sk: 'meta' } },
      'NOT_EXISTS'
    )
  } catch (e) {
    if (e.code === 'ConditionalCheckFailedException') return null
    throw e
  }
}

export const createConversation = async ({
  id,
  channels,
  participants,
}: Conversation) => {
  try {
    await Promise.all([
      put(
        'conversations',
        {
          key: { pk: prefix.conversation(id), sk: 'meta' },
          channels: ddb.createSet(channels),
          participants: ddb.createSet(participants),
        },
        'NOT_EXISTS'
      ),
      participants.flatMap(user => [
        update('connections', { pk: prefix.user(user), sk: 'meta' }, [
          'ADD',
          'conversations',
          id,
        ]),
      ]),
    ])
  } catch (e) {
    if (e.code === 'ConditionalCheckFailedException') return null
    throw e
  }
}

export const createClient = async (id: string) => {
  await Promise.all([
    put(
      'connections',
      { key: { pk: prefix.client(id), sk: 'meta' } },
      'NOT_EXISTS'
    ),
  ])
}

export const removeClient = async (id: string) =>
  await remove('connections', { pk: prefix.client(id), sk: 'meta' }, true)

export const identifyClient = async (client: string, user: string) => {
  try {
    await update(
      'connections',
      { pk: prefix.client(client), sk: 'meta' },
      ['SET', 'user', user],
      undefined,
      'EXISTS'
    )
    await update('connections', { pk: prefix.user(user), sk: 'meta' }, [
      'ADD',
      'clients',
      client,
    ])
  } catch (e) {
    console.error(e)
    if (e.code === 'ConditionalCheckFailedException') return null
    throw e
  }
}

export const removeUserClient = async (user: string, client: string) => {
  await update('connections', { pk: prefix.user(user), sk: 'meta' }, [
    'DELETE',
    'clients',
    client,
  ])
}

export const subscribeClient = async (
  type: 'messages' | 'channels',
  client: string,
  items: string[],
  subscriptionId: string,
  query: string,
  variables: any
) => {
  await Promise.all([
    batchWrite(
      'connections',
      items.map(item => ({
        key: {
          pk: prefix[type === 'messages' ? 'channel' : 'conversation'](item),
          sk: prefix.client(client),
        },
        subscriptionId,
        query,
        variables,
        ttl: Date.now() + 1000 * 60 ** 2 * 12,
      }))
    ),
    update('connections', { pk: prefix.client(client), sk: 'meta' }, [
      'ADD',
      type === 'messages' ? 'channels' : 'conversations',
      items,
    ]),
  ])
}

export const unsubscribeClient = async (
  type: 'messages' | 'channels',
  client: string,
  items: string[],
  skipMeta = false
) => {
  await Promise.all([
    batchDelete(
      'connections',
      items.map(item => ({
        pk: prefix[type === 'messages' ? 'channel' : 'conversation'](item),
        sk: prefix.client(client),
      }))
    ),
    ...((skipMeta
      ? []
      : [
          update('connections', { pk: prefix.client(client), sk: 'meta' }, [
            'DELETE',
            type === 'messages' ? 'channels' : 'conversations',
            items,
          ]),
        ]) as Promise<any>[]),
  ])
}

export const subscribeConversations = async (
  client: string,
  subscriptionId: string,
  query: string,
  variables: any
) => {
  await Promise.all([
    update('connections', { pk: prefix.client(client), sk: 'meta' }, [
      'SET',
      'subConv',
      true,
    ]),
    put('connections', {
      key: { pk: prefix.client(client), sk: 'SUB_CONV' },
      subscriptionId,
      query,
      variables,
    }),
  ])
}

export const unsubscribeConversations = async (
  client: string,
  skipMeta = false
) => {
  await Promise.all([
    remove('connections', { pk: prefix.client(client), sk: 'SUB_CONV' }),
    ...(skipMeta
      ? []
      : [
          update('connections', { pk: prefix.client(client), sk: 'meta' }, [
            'SET',
            'subConv',
            false,
          ]),
        ]),
  ])
}

export const createChannel = async (
  conversationId: string,
  channelId: string
) => {
  await Promise.all([
    put('conversations', {
      key: {
        pk: prefix.channel(channelId),
        sk: prefix.conversation(conversationId),
      },
    }),
    update(
      'conversations',
      {
        pk: prefix.conversation(conversationId),
        sk: 'meta',
      },
      ['ADD', 'channels', channelId],
      true
    ).then(({ participants }) => {
      Promise.all(
        participants?.map((id: string) =>
          update('connections', { pk: prefix.user(id), sk: 'meta' }, [
            'ADD',
            'channels',
            channelId,
          ])
        ) ?? []
      )
    }),
    query(
      'connections',
      ['pk', '=', conversationId],
      ['sk', 'begins', prefix.client()]
    ).then(clients =>
      Promise.all(
        clients?.map(({ sk }) =>
          put('connections', { key: { pk: prefix.channel(channelId), sk } })
        ) ?? []
      )
    ),
  ])
}

export const publishMessage = async ({
  id,
  channel,
  ...rest
}: {
  id: string
  time: number
  channel: string
  author: string
  content: string
}) => {
  await put('conversations', {
    key: { pk: prefix.channel(channel), sk: prefix.message(id) },
    ...rest,
  })
}

export const getClients = async (ctx: 'channel' | 'conversation', id: string) =>
  await query(
    'connections',
    ['pk', '=', prefix[ctx](id)],
    ['sk', 'begins', prefix.client()]
  )
