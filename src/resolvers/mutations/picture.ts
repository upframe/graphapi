import resolver from '../resolver'
import { s3 } from '../../utils/aws'
import { User, ProfilePicture } from '../../models'

export const uploadProfilePicture = resolver<User>()(
  async ({ args: { file }, ctx: { id }, query }) => {
    const user = await query({ include: 'profile_pictures' }).findById(id)
    const urls = user.profile_pictures?.map(({ url }) => url)

    if (urls?.length) {
      const Objects = [
        `${id}.jpeg`,
        ...urls.map(url => url.replace(/^.+amazonaws\.com\/(.+)$/, '$1')),
      ].map(Key => ({ Key }))

      await Promise.all([
        query
          .raw(ProfilePicture)
          .whereIn('url', urls)
          .delete(),
        s3
          .deleteObjects({
            Bucket: process.env.BUCKET_NAME,
            Delete: { Objects },
          })
          .promise(),
      ])
    }

    const data = new Buffer(
      file.replace(/^data:image\/\w+;base64,/, ''),
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

    user.profile_pictures = [
      {
        url: `${process.env.BUCKET_URL}${id}.png`,
      } as ProfilePicture,
    ]
    return user
  }
)

export const removeProfilePicture = resolver<User>()(
  async ({ ctx: { id }, query }) => {
    const user = await query({ include: 'profile_pictures' }).findById(id)
    const urls = user.profile_pictures?.map(({ url }) => url)
    if (!urls) return user

    const Objects = [
      `${id}.jpeg`,
      ...urls.map(url => url.replace(/^.+amazonaws\.com\/(.+)$/, '$1')),
    ].map(Key => ({ Key }))

    await Promise.all([
      query
        .raw(ProfilePicture)
        .whereIn('url', urls)
        .delete(),
      s3
        .deleteObjects({
          Bucket: process.env.BUCKET_NAME,
          Delete: { Objects },
        })
        .promise(),
    ])

    delete user.profile_pictures
    return user
  }
)
