import { createLogger, format, transports } from 'winston'

let requestId: string

export default Object.assign(
  createLogger({
    defaultMeta: {
      get 'context.awsRequestId'() {
        return requestId
      },
    },
    transports: [
      new transports.Console({
        format:
          process.env.NODE_ENV === 'production'
            ? format.combine(format.timestamp(), format.json())
            : format.combine(
                format.colorize(),
                format.timestamp({
                  format: 'HH:mm:ss',
                }),
                format.printf(
                  ({ timestamp, level, message, extensions, opName }) => {
                    let msg = `${timestamp} ${level}: ${message}`
                    if (opName) msg += ` ${opName}`
                    if (!extensions?.exception?.stacktrace) return msg
                    const stack = []
                    for (const path of extensions.exception.stacktrace.slice(
                      1
                    )) {
                      if (!path.includes(':/src/')) break
                      stack.push(path.replace(/\/[\w/.]+:\/src\//, ''))
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
  }
)
