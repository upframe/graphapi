import mailgun from 'mailgun-js'
import { User } from './models'
import AWS from 'aws-sdk'

const mail = mailgun({
  domain: 'upframe.io',
  apiKey: process.env.MAILGUN_KEY,
})

AWS.config.update({ region: 'eu-west-2' })
const s3 = new AWS.S3()

async function getTemplate(
  name: string,
  args: { [k: string]: string | undefined } = {}
) {
  const { Body } = await s3
    .getObject({ Bucket: 'upframe-email-templates', Key: `${name}.html` })
    .promise()
  let file = Body.toString()
  ;[...file.matchAll(/<!-- ([A-Z]+)-START -->/g)].forEach(
    ({
      0: { length: startLength },
      1: match,
      index: startIndex = Infinity,
    }) => {
      file = file.replace(
        file.substring(startIndex, startIndex + startLength),
        ''
      )
      const {
        0: { length: endLength },
        index: endIndex = Infinity,
      } = file.match(`<!-- ${match}-END -->`) as RegExpMatchArray
      file = file.replace(file.substring(endIndex, endIndex + endLength), '')
      if (!args[match])
        file = file.replace(file.substring(startIndex, endIndex), '')
    }
  )
  Object.entries(args)
    .filter(([, v]) => v)
    .forEach(([k, v]) => {
      file = file.replace(new RegExp(k, 'g'), v as string)
    })
  return file
}

getTemplate('message', { MENTOR: '', MESSAGE: '', USER: '' }).then(console.log)

export async function send(
  receiver: User,
  from: Partial<User>,
  message: string
) {
  const senderName = from.name.split(' ')[0]
  const receiverName = from.name.split(' ')[0]
  const subject = `${senderName} sent you a message`
  mail.messages().send({
    from: 'Upframe team@upframe.io',
    to: `${receiverName} ${receiver.email}`,
    subject,
    html: await getTemplate('message', {
      MENTOR: receiverName,
      USER: senderName,
      MESSAGE: message,
      EMAIL: `${from.email}?subject=Re: ${subject}&Body=\n\n---\n${message}`,
    }),
  })
}
