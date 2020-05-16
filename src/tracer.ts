import tracer from 'dd-trace'
import logger from './logger'

tracer.init(process.env.IS_OFFLINE ? undefined : { logger })

export default tracer
