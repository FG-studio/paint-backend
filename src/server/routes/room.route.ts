import { FastifyInstance } from 'fastify'
import { RoomManager } from 'server/controllers'
import {
  UserInfoInput,
  ErrorSchemaWithCode,
  RoomConfig,
  RoomIdParams,
  RoomListResponse,
  RoomResponse,
  statusResponse,
  UserSubmitData,
  JoinRoomResponse,
  RoomUpdateConfigRequest,
  RoomSumaryResponse,
  RoomUserParam,
  RoomResultQuery,
} from 'server/schema'
import { z } from 'zod'

module.exports = function (fastify: FastifyInstance, opts: any, done: any) {
  const { tags, ...option } = opts
  fastify.post(
    '',
    {
      ...option,
      schema: {
        tags,
        body: UserInfoInput,
        response: {
          ...ErrorSchemaWithCode,
          201: JoinRoomResponse,
        },
      },
    },
    (req, reply) => {
      const data = UserInfoInput.parse(req.body)
      const res = RoomManager.Instance.createRoom({
        id: data.user_id,
        name: data.username,
        isHost: true,
      })
      reply.code(201).send(res)
    },
  )

  fastify.get(
    '/:id',
    {
      ...option,
      schema: {
        tags,
        params: RoomIdParams,
        response: {
          ...ErrorSchemaWithCode,
          200: RoomResponse,
        },
      },
    },
    (req, reply) => {
      const params = RoomIdParams.parse(req.params)
      const res = RoomManager.Instance.getRoom(params.id)
      reply.code(200).send(res)
    },
  )

  fastify.get(
    '',
    {
      ...option,
      schema: {
        tags,
        response: {
          ...ErrorSchemaWithCode,
          200: RoomListResponse,
        },
      },
    },
    (req, reply) => {
      const res = RoomManager.Instance.listRoom()
      reply.code(200).send(res)
    },
  )

  fastify.patch(
    '/:id/config',
    {
      ...option,
      schema: {
        tags,
        params: RoomIdParams,
        body: RoomUpdateConfigRequest,
        response: {
          ...ErrorSchemaWithCode,
          200: RoomConfig,
        },
      },
    },
    (req, reply) => {
      const params = RoomIdParams.parse(req.params)
      const data = RoomUpdateConfigRequest.parse(req.body)

      const res = RoomManager.Instance.updateRoomConfig(
        params.id,
        data.user_id,
        data.config,
      )
      reply.code(200).send(res)
    },
  )

  fastify.put(
    '/:id/join',
    {
      ...option,
      schema: {
        tags,
        params: RoomIdParams,
        body: UserInfoInput,
        response: {
          ...ErrorSchemaWithCode,
          200: JoinRoomResponse,
        },
      },
    },
    (req, reply) => {
      const params = RoomIdParams.parse(req.params)
      const data = UserInfoInput.parse(req.body)
      const res = RoomManager.Instance.joinRoom(params.id, {
        id: data.user_id,
        name: data.username,
      })

      reply.code(200).send(res)
    },
  )

  fastify.put(
    '/:id/start',
    {
      ...option,
      schema: {
        tags,
        params: RoomIdParams,
        body: z.object({
          user_id: z.string().nonempty(),
        }),
        response: {
          ...ErrorSchemaWithCode,
          200: statusResponse,
        },
      },
    },
    (req, reply) => {
      const params = RoomIdParams.parse(req.params)
      const body = z
        .object({
          user_id: z.string().nonempty(),
        })
        .parse(req.body)
      const res = RoomManager.Instance.startRoom(params.id, body.user_id)
      reply.code(200).send({
        status: res,
      })
    },
  )

  fastify.put(
    '/:id/submit',
    {
      ...option,
      schema: {
        tags,
        params: RoomIdParams,
        body: UserSubmitData,
        response: {
          ...ErrorSchemaWithCode,
          200: statusResponse,
        },
      },
    },
    async (req, reply) => {
      const params = RoomIdParams.parse(req.params)
      const body = UserSubmitData.parse(req.body)
      const res = await RoomManager.Instance.submitRoundData(params.id, body)
      reply.code(200).send({
        status: res,
      })
    },
  )

  fastify.get(
    '/:id/sumary',
    {
      ...option,
      schema: {
        tags,
        params: RoomIdParams,
        response: {
          ...ErrorSchemaWithCode,
          200: RoomSumaryResponse,
        },
      },
    },
    (req, reply) => {
      const params = RoomIdParams.parse(req.params)
      const res = RoomManager.Instance.getRoomSumary(params.id)
      reply.code(200).send(res)
    },
  )

  fastify.patch(
    '/:id/:user_id/unsubmit',
    {
      ...option,
      schema: {
        tags,
        params: RoomUserParam,
        response: {
          ...ErrorSchemaWithCode,
          200: statusResponse,
        },
      },
    },
    (req, reply) => {
      const params = RoomUserParam.parse(req.params)
      const res = RoomManager.Instance.unReady(params.id, params.user_id)
      reply.code(200).send(res)
    },
  )

  fastify.patch(
    '/:id/:user_id/leave',
    {
      ...option,
      schema: {
        tags,
        params: RoomUserParam,
        response: {
          ...ErrorSchemaWithCode,
          200: statusResponse,
        },
      },
    },
    (req, reply) => {
      const params = RoomUserParam.parse(req.params)
      const res = RoomManager.Instance.leaveRoom(params.id, params.user_id)
      reply.code(200).send(res)
    },
  )

  fastify.get(
    '/:id/:user_id/request_result',
    {
      ...option,
      schema: {
        tags,
        params: RoomUserParam,
        querystring: RoomResultQuery,
        response: {
          ...ErrorSchemaWithCode,
          200: RoomResultQuery,
        },
      },
    },
    (req, reply) => {
      const params = RoomUserParam.parse(req.params)
      const query = RoomResultQuery.parse(req.query)

      const res = RoomManager.Instance.nextResult(
        params.id,
        params.user_id,
        query,
      )
      reply.code(200).send(res)
    },
  )

  done()
}
