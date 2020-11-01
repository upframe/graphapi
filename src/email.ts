import { sns } from './utils/aws'

interface SendOptions {
  template: string
  ctx: any
}
export const send = async ({ template, ctx }: SendOptions) => {
  if (process.env.DISABLE_EMAILS === 'true') return

  try {
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
  } catch (error) {
    logger.error("couldn't dispatch email send event", { template, ctx, error })
    throw error
  }
}
