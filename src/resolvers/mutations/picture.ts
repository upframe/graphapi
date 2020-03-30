import resolver from '../resolver'
import { S3 } from 'aws-sdk'

const s3 = new S3({
  accessKeyId: process.env.AWS_KEY_ID,
  secretAccessKey: process.env.AWS_KEY_SECRET,
})

export const uploadProfilePicture = resolver()(
  async ({ args: { file }, ctx: { id } }) => {
    const data = new Buffer(
      await file.replace(/^data:image\/\w+;base64,/, ''),
      'base64'
    )
    await s3
      .upload({
        Bucket: process.env.BUCKET_NAME,
        Key: `${id}.png`,
        Body: data,
        ACL: 'public-read',
      })
      .promise()
  }
)
