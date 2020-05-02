import { tracer } from 'dd-trace'
import logger from './logger'

if (!process.env.IS_OFFLINE) {
  tracer.init({
    debug: false,
    enabled: true,
    env: process.env.stage,
    logger,
    plugins: false,
    service: 'graphapi',
  })
}

export default tracer
