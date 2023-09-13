import { PORT } from 'config'
import { HttpServer } from 'server'
;(async () => {
  const server = new HttpServer({
    port: PORT,
    websocket: true,
  })
  await server.init()
  await server.start()
})()
