import logger from '../logger'

export const message = {
  subscribe: () => {
    logger.info('subscription subscribe')
  },
  resolve(payload) {
    logger.info('subscription resolve', { payload })
  },
}
