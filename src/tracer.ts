import { tracer } from 'dd-trace'
import logger from './logger'

if (!process.env.IS_OFFLINE) {
  tracer.init({
    debug: true,
    enabled: true,
    env: process.env.stage,
    logger,
    plugins: true,
    service: 'graphapi',
  })

  tracer.use('knex')
  tracer.use('graphql', {
    depth: -1,
  })
}

export default tracer
