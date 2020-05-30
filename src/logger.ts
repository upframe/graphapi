import { createLogger, format, transports } from 'winston'

let requestId: string
let userId: string

export default Object.assign(
  createLogger({
    level: 'debug',
    defaultMeta: {
      get 'context.awsRequestId'() {
        return requestId
      },
      get 'context.user'() {
        return userId
      },
    },
    transports: [
      new transports.Console({
        format: !process.env.IS_OFFLINE
          ? format.combine(format.timestamp(), format.json())
          : format.combine(
              format.colorize(),
              format.timestamp({
                format: 'HH:mm:ss',
              }),
              format.printf(
                ({ timestamp, level, message, extensions, opName }) => {
                  let msg = `${timestamp} ${level}: ${
                    typeof message === 'string'
                      ? message
                      : JSON.stringify(message)
                  }`
                  if (opName) msg += ` ${opName}`
                  if (!extensions?.exception?.stacktrace) return msg
                  const stack = []
                  for (const path of extensions.exception.stacktrace.slice(1)) {
                    stack.push(
                      path.replace(/\/[\w/.]+(:\/src|node_modules)\//, '')
                    )
                  }
                  return msg + `\n${stack.join('\n')}`
                }
              )
            ),
      }),
    ],
  }),
  {
    setRequestId(id) {
      requestId = id
    },
    setUserId(id) {
      userId = id
    },
  }
)
