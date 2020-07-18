import * as db from './db'
import { execute, parse } from 'graphql'
import { schema } from '~/apollo'
import Client from './client'

export default async function (
  event: 'INSERT' | 'MODIFY' | 'REMOVE',
  newImage: any
) {
  const prefix = Object.fromEntries(
    ['pk', 'sk'].map(k => [k, newImage[k]?.split('|')[0]?.replace(/\|$/, '')])
  )
  if (!prefix) return

  if (prefix.sk === 'MSG') {
    if (event !== 'INSERT') return
    await newMessage(newImage)
  }

  if (prefix.sk === 'MSG') {
    if (event === 'INSERT') await newMessage(newImage)
    return
  }
  if (prefix.pk === 'CHANNEL') {
    if (event === 'INSERT') await newChannel(newImage)
    return
  }
}

async function newMessage({
  pk,
  sk,
  ...rest
}: {
  pk: string
  sk: string
  author: string
  time: number
  content: string
}) {
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

  await Promise.all([
    clients.map(({ id, query, variables, subscriptionId }) =>
      exec({ message }, query, variables).then(res =>
        new Client(id).post(res, subscriptionId)
      )
    ),
  ])
}

async function newChannel({ pk, sk }: { pk: string; sk: string }) {
  const channelId = pk.replace(db.prefix.channel(), '')
  const conversationId = sk.replace(db.prefix.conversation(), '')

  const clients: any = (
    await db.getClients('conversation', conversationId)
  ).map(({ sk, ...rest }) => ({
    id: sk.replace(db.prefix.client(), ''),
    ...rest,
  }))

  await Promise.all([
    clients.map(({ id, query, variables, subscriptionId }) =>
      exec(
        { channel: { id: channelId, conversationId } },
        query,
        variables
      ).then(res => new Client(id).post(res, subscriptionId))
    ),
  ])
}

const exec = async (
  rootValue: any,
  query: string,
  variableValues: any
): Promise<any> => {
  const res = execute({
    document: parse(query),
    schema,
    variableValues,
    rootValue,
  }) as any
  if (typeof res.then === 'function') return await res
  return res
}
