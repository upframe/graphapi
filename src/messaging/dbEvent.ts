import * as db from './db'
import { batchRead, update } from './dbOps'
import { execute, parse } from 'graphql'
import { schema } from '~/apollo'
import Client from './client'
import logger from '~/logger'
import AuthUser from '~/authorization/user'
import dbConnect from '~/db'
import { diff } from '~/utils/array'
import { stepFunc } from '~/utils/aws'

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

  const clients: any = (await db.getClients('channel', message.channel)).map(
    ({ sk, ...rest }) => ({
      id: sk.replace(db.prefix.client(), ''),
      ...rest,
    })
  )

  const userIds = Array.from(new Set(clients.map(({ user }) => user))).filter(
    Boolean
  ) as string[]

  await Promise.all([
    ...clients.map(({ id, query, variables, subscriptionId, user }) =>
      exec({ message }, query, variables, user, rdb).then(res =>
        new Client(id).post(res, subscriptionId)
      )
    ),
    !process.env.IS_OFFLINE &&
      db.getUsers(userIds).then(users =>
        Promise.all(
          users
            .filter(({ subEmail }) => subEmail)
            .map(({ pk, mailSFArn }) => {
              const user = pk.replace(db.prefix.user(), '')
              const channel = message.channel
              return Promise.allSettled([
                mailSFArn &&
                  stepFunc
                    .stopExecution({ executionArn: mailSFArn })
                    .promise()
                    .catch(logger.error),
                stepFunc
                  .startExecution({
                    stateMachineArn: process.env.MSG_EMAIL_SF_ARN,
                    input: JSON.stringify({ user, channel }),
                  })
                  .promise()
                  .then(({ executionArn }) =>
                    update(
                      'connections',
                      { pk: db.prefix.user(user), sk: 'meta' },
                      [['SET', 'mailSFArn', executionArn]]
                    )
                  ),
              ])
            })
        )
      ),
  ])
}

async function newChannel({ pk, sk }: { pk: string; sk: string }, rdb: any) {
  const channelId = pk.replace(db.prefix.channel(), '')
  const conversationId = sk.replace(db.prefix.conversation(), '')

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
