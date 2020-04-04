import AWS from 'aws-sdk'

AWS.config.update({ region: 'eu-west-2' })

export const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_KEY_ID,
  secretAccessKey: process.env.AWS_KEY_SECRET,
})
