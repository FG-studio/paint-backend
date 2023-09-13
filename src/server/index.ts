import { SWAGGER_ENDPOINT } from 'config'
import fastify from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { getLogger } from 'helpers'
import { WebSocketServer } from 'ws'
import { ZodError } from 'zod'
import { websocketResolver } from './socket'
import { SystemError, ErrorCode2StatusCode } from './schema'
import path from 'path'

const qs = require('qs')

export type HttpServerConfig = {
  port: number
  websocket?: boolean
}

export class HttpServer {
  private _logger
  private _app
  private _wsServer: WebSocketServer | undefined
  constructor(private _config: HttpServerConfig) {
    this._logger = getLogger('http-gateway')
    this._app = fastify({
      querystringParser: (str) => qs.parse(str),
    })
    if (this._config.websocket) {
      this._wsServer = websocketResolver(this._app, '/ws')
    }
  }

  init = async (): Promise<void> => {
    this._app.setValidatorCompiler(validatorCompiler)
    this._app.setSerializerCompiler(serializerCompiler)
    this._app.setErrorHandler((error, request, reply) => {
      this._logger.error(error, `api ${request.routerPath} error`)
      switch (error.constructor.name) {
        case 'ZodError': {
          const tmp = error as any as ZodError
          reply.status(400).send({
            code: 'VALIDATION_ERROR',
            msg: JSON.stringify(tmp.issues),
          })
          break
        }
        case 'SystemError': {
          const tmp = error as SystemError
          const code = (ErrorCode2StatusCode as any)[tmp.code]
          reply.status(code || 500).send({
            code: tmp.code,
            msg: tmp.msg,
          })
          break
        }
        default: {
          reply.status(500).send({
            code: 'UNKNOW_ERROR',
            msg: error.message,
          })
          break
        }
      }
    })
    await this._app.register(require('@fastify/cors'), {})
    await this._app.register(require('@fastify/multipart'))
    await this._app.register(require('@fastify/swagger'), {
      openapi: {
        info: {
          title: 'Laika local service API',
          description: 'Sample backend service',
          version: '0.0.1',
        },
        servers: SWAGGER_ENDPOINT,
        components: {
          securitySchemes: {},
        },
      },
      transform: jsonSchemaTransform,
    })
    await this._app.register(require('@fastify/swagger-ui'), {
      routePrefix: '/documentation',
    })
    await this._app.register(require('@fastify/static'), {
      root: path.join(process.cwd(), 'public'),
      prefix: '/public/', // optional: default '/'
    })
    this._app.register(require('./routes'), {
      prefix: '/api',
      preValidation: [],
      preSerialization: [],
    })
  }

  start = (): Promise<void> => {
    return new Promise((resolve) => {
      this._app.listen(
        {
          host: '0.0.0.0',
          port: this._config.port,
        },
        (err) => {
          if (err) {
            this._logger.fatal(err, `server started failed... `)
            process.exit(-1)
          }
          this._logger.info(`server is running in port ${this._config.port}`)
          resolve()
        },
      )
    })
  }
}
