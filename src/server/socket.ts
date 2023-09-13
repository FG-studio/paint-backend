import url from 'url'
import { FastifyInstance } from 'fastify'
import { IncomingMessage } from 'http'
import { WebSocket, WebSocketServer } from 'ws'
import { getLogger } from 'helpers'
import { AgentController } from './controllers'

export const websocketResolver = (ins: FastifyInstance, path: string) => {
  const logger = getLogger('websocket-resolver')
  const wsServer = new WebSocketServer({
    server: ins.server,
    path,
  })
  wsServer.on('connection', (socket: WebSocket, req: IncomingMessage) => {
    if (!req.url) {
      socket.close()
      return
    }
    try {
      const data = url.parse(req.url, true).query
      logger.debug(data, `websocket query data`)
      const { room, user_id } = data
      AgentController.Instance.onConnect(
        socket,
        room as string,
        user_id as string,
      )
    } catch (e) {
      logger.error(e, `error when resolve websocket`)
    }
  })

  return wsServer
}
