import * as db from './db'
import { update } from './dbOps'
import { stepFunc } from '~/utils/aws'

export default class User {
  constructor(public readonly id: string) {}

  public async info() {
    return { ...this, ...(await db.getUser(this.id)) }
  }

  public async wantsEmailNotifications(v: boolean) {
    const old = await update(
      'connections',
      { pk: db.prefix.user(this.id), sk: 'meta' },
      [['SET', 'subEmail', v]],
      'OLD'
    )
    if (v) return
    const cancel = Object.keys(old).filter(k => k.startsWith('mail_'))
    await Promise.all([
      ...(cancel.length
        ? [
            update(
              'connections',
              { pk: db.prefix.user(this.id), sk: 'meta' },
              cancel.map(k => ['REMOVE', k])
            ),
          ]
        : []),
      ...(Object.entries(old)
        .filter(([k]) => k.startsWith('mail_arn_'))
        .map(([, v]) => this.stopMailSF(v)) as Promise<any>[]),
    ])
  }

  private async stopMailSF(executionArn: string) {
    await stepFunc.stopExecution({ executionArn }).promise().catch(logger.error)
  }

  public async queueEmailNotification(
    channelId: string,
    msgId: string,
    checkSubscription = false
  ) {
    if (checkSubscription) {
      const { subEmail } = await this.info()
      if (!subEmail) return
    }

    const { executionArn } = await stepFunc
      .startExecution({
        stateMachineArn: process.env.MSG_EMAIL_SF_ARN,
        input: JSON.stringify({
          user: this.id,
          channel: channelId,
        }),
      })
      .promise()

    const old = await update(
      'connections',
      { pk: db.prefix.user(this.id), sk: 'meta' },
      [
        ['SET', `mail_arn_channel_${channelId}`, executionArn],
        ['ADD', `mail_pending_channel_${channelId}`, msgId],
      ],
      'OLD'
    )

    if (old?.[`mail_arn_channel_${channelId}`])
      await this.stopMailSF(old?.[`mail_arn_channel_${channelId}`])
  }

  public async markRead(batches: { channel: string; msgs: string[] }[]) {
    await Promise.all([
      update(
        'connections',
        { pk: db.prefix.user(this.id), sk: 'meta' },
        batches.flatMap(({ channel, msgs }) => [
          ['DELETE', `unread_${channel}`, msgs],
          ['DELETE', `mail_pending_channel_${channel}`, msgs],
        ]),
        true
      ).then(info => {
        logger.info('read', { info, batches })
        const allRead = batches
          .filter(
            ({ channel }) =>
              !info[`mail_pending_channel_${channel}`] &&
              info[`mail_arn_channel_${channel}`]
          )
          .map(({ channel }) => channel)
        if (allRead.length === 0) return
        return Promise.all([
          update(
            'connections',
            { pk: db.prefix.user(this.id), sk: 'meta' },
            allRead.map(channel => ['REMOVE', `mail_arn_channel_${channel}`])
          ),
          ...(allRead.map(channel =>
            this.stopMailSF(info[`mail_arn_channel_${channel}`])
          ) as Promise<any>[]),
        ])
      }),
      ...batches.flatMap(({ msgs, channel }) =>
        msgs.map(id =>
          update(
            'conversations',
            {
              pk: db.prefix.channel(channel),
              sk: db.prefix.message(id),
            },
            [['ADD', 'read', this.id]]
          )
        )
      ),
    ])
  }
}
