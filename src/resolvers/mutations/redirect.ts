import resolver from '../resolver'
import logger from '../../logger'
import { ddb } from '../../utils/aws'
import { UserInputError } from '../../error'

export const setRedirect = resolver<void>().isAdmin(
  async ({ args: { from, to, expires } }) => {
    if (!to || !from) throw new UserInputError('must provide to & from paths')

    await ddb
      .put({
        TableName: 'redirects',
        Item: { path: from, to, ...(expires && { expires }) },
      })
      .promise()

    logger.info('redirect added', { from, to, expires })
  }
)

export const deleteRedirect = resolver<void>().isAdmin(
  async ({ args: { path } }) => {
    await ddb.delete({ TableName: 'redirects', Key: { path } }).promise()
  }
)
