import { tracer } from 'dd-trace'
import logger from './logger'

if (!process.env.IS_OFFLINE) {
  tracer.init({
    debug: true,
    logger,
    logInjection: true,
  })
}

export default tracer
