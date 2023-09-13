import { FastifyInstance } from 'fastify'

module.exports = function (fastify: FastifyInstance, opts: any, done: any) {
  fastify.register(require('./room.route'), {
    ...opts,
    prefix: 'rooms',
    tags: ['rooms'],
  })
  done()
}
