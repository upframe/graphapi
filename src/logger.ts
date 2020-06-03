import { createLogger, format as wsFormat, transports } from 'winston'

let ch: import('chalk').Chalk
if (process.env.IS_OFFLINE) {
  ch = require('chalk')
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
          ? wsFormat.combine(wsFormat.timestamp(), wsFormat.json())
          : wsFormat.combine(
              wsFormat(info =>
                block.some(exp => exp.test(info.message)) ? false : info
              )(),
              wsFormat.colorize(),
              wsFormat.timestamp({
                format: 'HH:mm:ss',
              }),
              wsFormat.printf(
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
  if (typeof msg === 'string' && msg.startsWith('!'))
    msg = ch.bold(msg.substr(1))
  if (typeof msg === 'string' && msg.startsWith('\n')) {
    console.log(msg.replace(/^\n+(.*)/gs, ''))
    msg = msg.replace(/^\n+/gs, '')
  }
  return typeof msg === 'object' ? format(msg) : msg
}

const format = (v: unknown, indent = 0) => {
  return typeof v === 'string'
    ? formatString(v, indent)
    : typeof v === 'number'
    ? formatNumber(v, indent)
    : Array.isArray(v)
    ? formatArray(v, indent)
    : typeof v === 'object' && v !== null
    ? formatObject(v, indent)
    : ' '.repeat(indent) + v
}

const formatObject = (obj: unknown, indent = 0) => {
  if (Object.keys(obj).length === 0) return '{}'
  return `{\n${Object.entries(obj)
    .map(
      ([k, v]) =>
        `${' '.repeat(indent + 2)}${ch.blueBright(k)}: ${
          k === 'query' && typeof v === 'string'
            ? formatGQL(v, indent + 4)
            : format(v, indent + 2)
        }`
    )
    .join('\n')}\n${' '.repeat(indent)}}`
}

const formatArray = (arr: unknown[], indent = 0) => {
  const items = arr.map(item => format(item, 0))
  let assembled: string
  if (items.every(v => v.split('\n').length === 1))
    assembled = `[${items.join(', ')}]`
  else {
    assembled = `[\n${items.join(',\n')}\n]`
  }
  return assembled
    .split('\n')
    .map(
      (line, i, { length }) =>
        ' '.repeat(i === 0 ? 0 : indent + (i === length - 1 ? 0 : 2)) + line
    )
    .join('\n')
}

const formatString = (v: string, indent = 0): string =>
  ch.green(`'${indentString(v, indent)}'`)

const formatNumber = (v: number, indent = 0): string =>
  ch.yellow(' '.repeat(indent) + v)

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
    ch.hex('#29b973')(
      indentString(v, indent, 0)
        .replace(/(?<=\$\w+:\s*)(\w+)/g, ch.hex('#f9e922')('$1'))
        .replace(
          /(fragment\s+)(\w+)(\s+on\s+)(\w+)/g,
          ch.hex('#2a7ed3')('$1') +
            ch.hex('#38bdc1')('$2') +
            ch.hex('#2a7ed3')('$3') +
            ch.hex('#f9e922')('$4')
        )
        .replace(
          /(query|mutation|subscription|fragment)\s(\w+)/,
          ch.hex('#2a7ed3')('$1 ') + ch.hex('#38bdc1')('$2')
        )
        .replace(/(?<=(?:\(|,\s*))(\w+):/g, ch.hex('#f77466')('$1') + ':')
        .replace(/(:\s*)(true|false)/g, '$1' + ch.hex('#d47509')('$2'))
        .replace(/(:\s*)("[^"]*")/g, '$1' + ch.hex('#d64292')('$2'))
        .replace(/(\$\w+)/g, ch.hex('#d64292')('$1'))
        .replace(/(:\s*)(\d+)/g, '$1' + ch.hex('#2882f9')('$2'))
        .replace(/(?<=\.{3}\s*)(\w+)/g, ch.hex('#38bdc1')('$1'))
        .replace(/([{}().,:])/g, ch.hex('#bbb')('$1'))
    )
  )
}
