import AWS from 'aws-sdk'

AWS.config.update({ region: 'eu-west-2' })

export const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_KEY_ID,
  secretAccessKey: process.env.AWS_KEY_SECRET,
})

export const sns = new AWS.SNS({
  ...(process.env.IS_OFFLINE && {
    endpoint: 'http://127.0.0.1:4002/email-prod-email',
  }),
  region: 'eu-west-1',
})
