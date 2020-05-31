import { createLogger, format, transports } from 'winston'

let chalk: import('chalk').Chalk
if (process.env.IS_OFFLINE) {
  chalk = require('chalk')
}

let requestId: string

export default Object.assign(
  createLogger({
    level: 'debug',
    defaultMeta: {
      get 'context.awsRequestId'() {
        return requestId
      },
    },
    transports: [
      new transports.Console({
        format: !process.env.IS_OFFLINE
          ? format.combine(format.timestamp(), format.json())
          : format.combine(
              format(info =>
                block.some(exp => exp.test(info.message)) ? false : info
              )(),
              format.colorize(),
              format.timestamp({
                format: 'HH:mm:ss',
              }),
              format.printf(
                ({ timestamp, level, message, extensions, opName }) => {
                  let msg = `${timestamp} ${level}: ${prettyPrint(message)}`
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
  }
)

const block = [/couldn't read xray trace header from env/]

const prettyPrint = (msg: unknown) => {
  if (typeof msg === 'string' && msg.startsWith('\n')) {
    console.log(msg.replace(/^\n+(.*)/gs, ''))
    msg = msg.replace(/^\n+/gs, '')
  }
  if (typeof msg !== 'object' || Array.isArray(msg) || msg === null) return msg
  return printObject(msg)
}

const printObject = (obj: unknown, indent = 0) => {
  if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) return obj
  if (Object.keys(obj).length === 0) return '{}'
  return `{\n${Object.entries(obj)
    .map(
      ([k, v]) =>
        `${' '.repeat(indent + 2)}${chalk.blueBright(k)}: ${
          typeof v === 'string'
            ? printString(v, indent + 4)
            : printObject(v, indent + 2)
        }`
    )
    .join('\n')}\n${' '.repeat(indent)}}`
}

const printString = (v: string, indent = 0) =>
  chalk.green(
    `'${v
      .replace(/^\n*|\n*$/gs, '')
      .split('\n')
      .map((line, i) => (i ? ' '.repeat(indent) + line : line))
      .join('\n')}'`
  )
