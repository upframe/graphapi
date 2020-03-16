import mailgun from 'mailgun-js'
import { User, Meetups, Slots } from './models'
import AWS from 'aws-sdk'

type Meetup = Partial<Meetups> & { slot: Partial<Slots> }

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

function send(receiver: User, subject: string, template) {
  mail.messages().send({
    from: 'Upframe team@upframe.io',
    to: `${receiver.name.split(' ')[0]} ${receiver.email}`,
    subject,
    html: template,
  })
}

export async function sendMessage(
  receiver: User,
  from: Partial<User>,
  message: string
) {
  const senderName = from.name.split(' ')[0]
  const receiverName = from.name.split(' ')[0]
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
  meetup: Meetup
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
