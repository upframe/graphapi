import mailgun from 'mailgun-js'
import { User, Meetup, Slots } from './models'
import { s3 } from './utils/aws'
import mustache from 'mustache'
import mjml from 'mjml'
import logger from './logger'

type Event = Partial<Meetup> & { slot: Partial<Slots> }

const mail = mailgun({
  domain: 'upframe.io',
  apiKey: process.env.MAILGUN_KEY,
})

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

function send(receiver: Partial<User>, subject: string, template) {
  if (!receiver.email) throw new Error('must provide email address')
  const email = {
    from: 'Upframe team@upframe.io',
    to: `${(receiver.name?.split(' ') ?? [])[0] ?? ''} ${receiver.email}`,
    subject,
    html: template,
  }
  mail.messages().send(email, error => {
    if (!error) return
    delete email.html
    logger.error("couldn't send email", { email, error })
  })
}

export async function sendMessage(
  receiver: User,
  from: Partial<User>,
  message: string
) {
  const senderName = from.name.split(' ')[0]
  const receiverName = receiver.name.split(' ')[0]
  const subject = `${senderName} sent you a message`
  send(
    receiver,
    subject,
    await getTemplate('message', {
      MENTOR: receiverName,
      USER: senderName,
      MESSAGE: message,
      EMAIL: `${from.email}?subject=Re: ${subject}&Body=\n\n---\n${message}`,
    })
  )
}

export async function sendMeetupRequest(
  mentor: User,
  mentee: User,
  meetup: Event
) {
  const senderName = mentee.name.split(' ')[0]
  const receiverName = mentee.name.split(' ')[0]
  const subject = `${senderName} invited you to a meetup`
  send(
    mentor,
    subject,
    await getTemplate('mentorRequest', {
      MENTOR: receiverName,
      USER: senderName,
      MESSAGE: meetup.message,
      MID: meetup.slot_id,
      EMAIL: mentee.email,
      LOCATION: meetup.location,
      DATE: new Date(meetup.slot.start).toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: 'Europe/Berlin',
      }),
      TIME: new Date(meetup.slot.start).toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Berlin',
      }),
    })
  )
}

export async function sendMeetupConfirmation(
  mentor: User,
  mentee: User,
  slot: Slots
) {
  send(
    mentee,
    `${mentor.name} accepted to meetup with you`,
    await getTemplate('meetupConfirmation', {
      MENTOR: mentor.name,
      USER: mentee.name,
      MESSAGE: slot.meetups.message,
      handle: mentor.handle,
      LOCATION: slot.meetups.location,
      DATE: new Date(slot.start).toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: 'Europe/Berlin',
      }),
      TIME: new Date(slot.start).toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Berlin',
      }),
    })
  )
}

interface SendOptions {
  template: string
  ctx: { [k: string]: string | boolean }
  to: Partial<User>
  subject: string
}
export async function sendMJML({ template, ctx, to, subject }: SendOptions) {
  const { Body } = await s3
    .getObject({
      Bucket: 'upframe-email-templates',
      Key: `${template.replace(/\.mjml$/, '')}.mjml`,
    })
    .promise()

  const { html, errors } = mjml(mustache.render(Body.toString(), ctx))
  if (!html || errors.length) throw new Error(errors)
  send(to, subject, html)
}
