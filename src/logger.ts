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
            ? k === 'query'
              ? formatGQL(v, indent + 4)
              : printString(v, indent + 4)
            : printObject(v, indent + 2)
        }`
    )
    .join('\n')}\n${' '.repeat(indent)}}`
}

const printString = (v: string, indent = 0): string =>
  chalk.green(`'${indentString(v, indent)}'`)

const indentString = (v: string, indent: number, exclude = 1): string =>
  v
    .replace(/^\n*|\n*$/gs, '')
    .split('\n')
    .map((line, i) => (i >= exclude ? ' '.repeat(indent) + line : line))
    .join('\n')

const formatGQL = (v: string, indent = 0): string => {
  const maxLength = Math.max(...v.split('\n').map(l => l.length))
  v = v
    .split('\n')
    .map(l => l + ' '.repeat(maxLength - l.length + 1))
    .join('\n')
  return (
    '\n' +
    chalk.hex('#29b973')(
      indentString(v, indent, 0)
        .replace(
          /(?<=fragment\s)(\w+)\son\s(\w+)/g,
          chalk.hex('#38bdc1')('$1') +
            chalk.hex('#2a7ed3')(' on ') +
            chalk.hex('#f9e922')('$2')
        )
        .replace(
          /(query|mutation|subscription|fragment)\s(\w+)/,
          '$1 ' + chalk.hex('#38bdc1')('$2')
        )
        .replace(
          /(query|mutation|subscription|fragment)(?=\s)/g,
          chalk.hex('#2a7ed3')('$1')
        )
        .replace(/(?<=(?:\(|,\s*))(\w+):/g, chalk.hex('#f77466')('$1') + ':')
        .replace(/(:\s*)(true|false)/g, '$1' + chalk.hex('#d47509')('$2'))
        .replace(/(:\s*)("[^"]*")/g, '$1' + chalk.hex('#d64292')('$2'))
        .replace(/(\$\w+)/g, chalk.hex('#d64292')('$1'))
        .replace(/(:\s*)(\d+)/g, '$1' + chalk.hex('#2882f9')('$2'))
        .replace(/([{}().,:])/g, chalk.hex('#bbb')('$1'))
    )
  )
}
