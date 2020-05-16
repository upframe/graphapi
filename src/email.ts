import { sns } from './utils/aws'

interface SendOptions {
  template: string
  ctx: any
}
export const send = async ({ template, ctx }: SendOptions) =>
  await sns
    .publish({
      Message: JSON.stringify({
        action: 'SEND_EMAIL',
        template,
        ...ctx,
      }),
      TopicArn: process.env.EMAIL_SNS,
    })
    .promise()
