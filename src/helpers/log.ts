import path from 'path'
import { ENV, LOG_LEVEL, NAMESPACE, DEBUG } from 'config'
import * as Pino from 'pino'
const namespace = `${NAMESPACE}-${ENV}`

const STACKTRACE_OFFSET = 2
const LINE_OFFSET = 7
const {
  symbols: { asJsonSym },
} = Pino.default

function traceCaller(pinoInstance: any) {
  const get = (target: any, name: any) =>
    name === asJsonSym ? asJson : target[name]

  function asJson(...args: any) {
    args[0] = args[0] || Object.create(null)
    args[0].caller = new Error().stack
      ?.split('\n')
      .filter(
        (s) =>
          !s.includes('node_modules/pino') && !s.includes('node_modules\\pino'),
      )
      [STACKTRACE_OFFSET].substr(LINE_OFFSET)
      .replace(path.resolve(__dirname, '..'), '')
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Unreachable code error
    return pinoInstance[asJsonSym].apply(this, args)
  }

  return new Proxy(pinoInstance, { get })
}

const logger = DEBUG
  ? traceCaller(
      Pino.default({
        name: namespace,
        level: LOG_LEVEL,
        transport: {
          targets: [
            {
              target: 'pino-pretty',
              options: {
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
              },
              level: LOG_LEVEL,
            },
          ],
        },
      }),
    )
  : Pino.default({
      name: namespace,
      level: LOG_LEVEL,
      transport: {
        targets: [
          {
            target: 'pino-pretty',
            options: {
              translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            },
            level: LOG_LEVEL,
          },
        ],
      },
    })

export function getLogger(name: string): Pino.BaseLogger {
  return logger.child({ name: `${namespace}.${name}` })
}
