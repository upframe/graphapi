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

const connectTTL = () => Date.now() + 1000 * 60 ** 2 * 12

export const getConversation = async (id: string) =>
  await get('conversations', { pk: prefix.conversation(id), sk: 'meta' })

export const getConversations = async (ids: string[]) =>
  await batchRead(
    'conversations',
    ids.map(id => ({ pk: prefix.conversation(id), sk: 'meta' }))
  )

export const getUser = async (id: string) =>
  await get('connections', { pk: prefix.user(id), sk: 'meta' })

export const getUsers = async (users: string[]) =>
  await batchRead(
    'connections',
    users.map(id => ({ pk: prefix.user(id), sk: 'meta' }))
  )

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
          ['ADD', 'conversations', id],
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
      [['SET', 'user', user]],
      undefined,
      'EXISTS'
    )
    await update('connections', { pk: prefix.user(user), sk: 'meta' }, [
      ['ADD', 'clients', client],
    ])
  } catch (e) {
    console.error(e)
    if (e.code === 'ConditionalCheckFailedException') return null
    throw e
  }
}

export const removeUserClient = async (user: string, client: string) => {
  await update('connections', { pk: prefix.user(user), sk: 'meta' }, [
    ['DELETE', 'clients', client],
  ])
}

export const subscribeClient = async (
  type: 'messages' | 'channels',
  client: string,
  items: string[],
  subscriptionId: string,
  query: string,
  variables: any,
  user: string
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
        ttl: connectTTL(),
        user,
      }))
    ),
    update('connections', { pk: prefix.client(client), sk: 'meta' }, [
      ['ADD', type === 'messages' ? 'channels' : 'conversations', items],
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
            [
              'DELETE',
              type === 'messages' ? 'channels' : 'conversations',
              items,
            ],
          ]),
        ]) as Promise<any>[]),
  ])
}

export const subscribeConversations = async (
  client: string,
  subscriptionId: string,
  query: string,
  variables: any,
  user: string
) => {
  await Promise.all([
    update('connections', { pk: prefix.client(client), sk: 'meta' }, [
      ['SET', 'subConv', true],
    ]),
    put('connections', {
      key: { pk: prefix.client(client), sk: 'SUB_CONV' },
      subscriptionId,
      query,
      variables,
      user,
      ttl: connectTTL(),
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
            ['SET', 'subConv', false],
          ]),
        ]),
  ])
}

export const subscribeRead = async (
  client: string,
  subscriptionId: string,
  query: string,
  variables: any,
  user: string
) => {
  await Promise.all([
    update('connections', { pk: prefix.client(client), sk: 'meta' }, [
      ['SET', 'subRead', true],
    ]),
    put('connections', {
      key: { pk: prefix.client(client), sk: 'SUB_READ' },
      subscriptionId,
      query,
      variables,
      user,
      ttl: connectTTL(),
    }),
  ])
}

export const unsubscribeRead = async (client: string, skipMeta = false) => {
  await Promise.all([
    remove('connections', { pk: prefix.client(client), sk: 'SUB_READ' }),
    ...(skipMeta
      ? []
      : [
          update('connections', { pk: prefix.client(client), sk: 'meta' }, [
            ['SET', 'subRead', false],
          ]),
        ]),
  ])
}

export const createChannel = async (
  conversationId: string,
  channelId: string,
  participants: string[]
) => {
  await Promise.all([
    put('conversations', {
      key: {
        pk: prefix.channel(channelId),
        sk: 'meta',
      },
      conversation: conversationId,
      participants: ddb.createSet(participants),
    }),
    update(
      'conversations',
      {
        pk: prefix.conversation(conversationId),
        sk: 'meta',
      },
      [['ADD', 'channels', channelId]],
      true
    ).then(({ participants }) => {
      Promise.all(
        participants?.map((id: string) =>
          update('connections', { pk: prefix.user(id), sk: 'meta' }, [
            ['ADD', 'channels', channelId],
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
  await Promise.all([
    put('conversations', {
      key: { pk: prefix.channel(channel), sk: prefix.message(id) },
      ...rest,
    }),
    getChannel(channel).then(({ participants }) =>
      Promise.all(
        participants
          .filter(user => user !== rest.author)
          .map(user =>
            update('connections', { pk: prefix.user(user), sk: 'meta' }, [
              ['ADD', `unread_${channel}`, id],
            ])
          )
      )
    ),
  ])
}

export const getChannel = async (id: string) =>
  await get('conversations', {
    pk: prefix.channel(id),
    sk: 'meta',
  })

export const getClients = async (ctx: 'channel' | 'conversation', id: string) =>
  await query(
    'connections',
    ['pk', '=', prefix[ctx](id)],
    ['sk', 'begins', prefix.client()]
  )

export const markRead = async (
  userId: string,
  batches: { channel: string; msgs: string[] }[]
) => {
  await Promise.all([
    update(
      'connections',
      { pk: prefix.user(userId), sk: 'meta' },
      batches.map(({ channel, msgs }) => ['DELETE', `unread_${channel}`, msgs])
    ),
    ...batches.flatMap(({ msgs, channel }) =>
      msgs.map(id =>
        update(
          'conversations',
          {
            pk: prefix.channel(channel),
            sk: prefix.message(id),
          },
          [['ADD', 'read', userId]]
        )
      )
    ),
  ])
}
