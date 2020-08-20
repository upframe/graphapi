import * as db from './db'
import { batchRead } from './dbOps'
import { execute, parse } from 'graphql'
import { schema } from '~/apollo'
import Client from './client'
import User from './user'
import AuthUser from '~/authorization/user'
import dbConnect from '~/db'
import { diff } from '~/utils/array'
import logger from '~/logger'

export default async function (
  event: 'INSERT' | 'MODIFY' | 'REMOVE',
  newImage: any,
  oldImage?: any
) {
  const prefix = Object.fromEntries(
    ['pk', 'sk'].map(k => [k, newImage[k]?.split('|')[0]?.replace(/\|$/, '')])
  )

  let rdb: any
  const knex = async () => {
    if (rdb) return rdb
    const { Model } = await import('~/models')
    rdb = dbConnect()
    Model.knex(rdb)
    return rdb
  }

  if (prefix.sk === 'MSG') {
    if (event === 'INSERT') await newMessage(newImage, knex)
    else if (event === 'MODIFY') await msgMod(newImage, oldImage, knex)
  } else if (prefix.pk === 'CHANNEL') {
    if (event === 'INSERT') await newChannel(newImage, knex)
  } else if (prefix.pk === 'CONV' && newImage.sk === 'meta') {
    if (event === 'INSERT') await newConversation(newImage, knex)
  }

  if (rdb) await rdb.destroy()
}

async function newMessage(
  {
    pk,
    sk,
    ...rest
  }: {
    pk: string
    sk: string
    author: string
    time: number
    content: string
  },
  rdb: any
) {
  const message = {
    channel: pk.replace(db.prefix.channel(), ''),
    id: sk.replace(db.prefix.message(), ''),
    ...rest,
  }

  let [clients, channel] = await Promise.all([
    db.getClients('channel', message.channel),
    db.getChannel(message.channel),
  ])

  clients = clients.map(({ sk, ...rest }) => ({
    id: sk.replace(db.prefix.client(), ''),
    ...rest,
  }))

  const userIds = JSON.parse(JSON.stringify(channel.participants))

  await Promise.all([
    ...clients.map(({ id, query, variables, subscriptionId, user }) =>
      exec({ message }, query, variables, user, rdb).then(res =>
        new Client(id).post(res, subscriptionId)
      )
    ),
    ...(!process.env.IS_OFFLINE &&
      userIds
        .filter(id => id !== message.author)
        .map(id =>
          new User(id)
            .queueEmailNotification(message.channel, message.id, true)
            .catch(error => {
              logger.error("couldn't queue message notification", { error })
              throw error
            })
        )),
  ])
}

async function newChannel(
  { pk, conversation: conversationId }: { pk: string; conversation: string },
  rdb: any
) {
  const channelId = pk.replace(db.prefix.channel(), '')

  const clients: any = (
    await db.getClients('conversation', conversationId)
  ).map(({ sk, ...rest }) => ({
    id: sk.replace(db.prefix.client(), ''),
    ...rest,
  }))

  await Promise.all(
    clients.map(({ id, query, variables, subscriptionId, user }) =>
      exec(
        { channel: { id: channelId, conversationId } },
        query,
        variables,
        user,
        rdb
      ).then(res => new Client(id).post(res, subscriptionId))
    )
  )
}

async function newConversation(
  {
    pk,
    participants,
  }: {
    pk: string
    participants: string[]
  },
  rdb: any
) {
  const id = pk.replace(db.prefix.conversation(), '')

  const users = await batchRead(
    'connections',
    participants.map(id => ({ pk: db.prefix.user(id), sk: 'meta' }))
  )

  const clients = users.flatMap(({ clients }) => clients ?? [])
  if (!clients.length) return

  const subs = await batchRead(
    'connections',
    clients.map(id => ({ pk: db.prefix.client(id), sk: 'SUB_CONV' }))
  )
  if (!subs.length) return

  await Promise.all(
    subs.map(({ pk, query, variables, subscriptionId, user }) =>
      exec(
        { conversation: { id, participants } },
        query,
        variables,
        user,
        rdb
      ).then(res =>
        new Client(pk.replace(db.prefix.client(), '')).post(res, subscriptionId)
      )
    )
  )
}

async function msgMod(newMsg: any, oldMsg: any, rdb: any) {
  const { added } = diff<string>(oldMsg?.read ?? [], newMsg.read ?? [], {
    deleted: false,
  })
  if (added.length === 0) return

  const { participants } = await db.getChannel(
    newMsg.pk.replace(db.prefix.channel(), '')
  )

  const users = await batchRead(
    'connections',
    participants.map((id: string) => ({ pk: db.prefix.user(id), sk: 'meta' }))
  )

  const clients = users.flatMap(({ clients }) => clients ?? [])
  if (!clients.length) return

  const subs = await batchRead(
    'connections',
    clients.map(id => ({ pk: db.prefix.client(id), sk: 'SUB_READ' }))
  )
  if (!subs.length) return

  await Promise.all(
    added.flatMap(add =>
      subs.map(({ pk, query, variables, subscriptionId, user }) =>
        exec(
          {
            read: {
              userId: add,
              channelId: newMsg.pk.replace(db.prefix.channel(), ''),
              msgId: newMsg.sk.replace(db.prefix.message(), ''),
            },
          },
          query,
          variables,
          user,
          rdb
        ).then(res =>
          new Client(pk.replace(db.prefix.client(), '')).post(
            res,
            subscriptionId
          )
        )
      )
    )
  )
}

const exec = async (
  rootValue: any,
  query: string,
  variableValues: any,
  user: string,
  rdb: any
): Promise<any> => {
  const res = execute({
    document: parse(query),
    schema,
    variableValues,
    rootValue,
    contextValue: {
      id: user,
      user: new AuthUser(user, undefined, 'user'),
      roles: ['user'],
      knex: await rdb(),
    },
  }) as any
  if (typeof res.then === 'function') return await res
  return res
}
