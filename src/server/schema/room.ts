import { GameState } from 'modules/draw-guest/types'
import { z } from 'zod'

export const UserInfoInput = z.object({
  user_id: z.string().nonempty(),
  username: z.string().nonempty(),
})

export const RoomIdParams = z.object({
  id: z.string(),
})

export const RoomStart = z.object({
  user_id: z.string().nonempty(),
})

export const UserSubmitData = z.object({
  user_id: z.string().nonempty(),
  payload: z.object({
    type: z.enum(['text', 'image']),
    data: z.string().default(''),
  }),
})

export const RoomUpdateConfig = z.object({
  maxPlayer: z.number().min(3).positive().optional(),
  reviewDuration: z.number().positive().optional(),
  drawDuration: z.number().positive().optional(),
  guestDuration: z.number().positive().optional(),
})

export const RoomUpdateConfigRequest = z.object({
  user_id: z.string().nonempty(),
  config: RoomUpdateConfig,
})

export const RoomConfig = z.object({
  maxPlayer: z.number().min(3).positive(),
  reviewDuration: z.number().positive(),
  drawDuration: z.number().positive(),
  guestDuration: z.number().positive(),
})

export const RoomResponse = z.object({
  id: z.string().nonempty(),
  state: z.nativeEnum(GameState),
  config: RoomConfig,
  users: z.array(
    z.object({
      id: z.string().nonempty(),
      name: z.string().nonempty(),
      isHost: z.boolean().default(false),
    }),
  ),
  host_id: z.string().nonempty(),
  show_order: z.array(z.string().nonempty()),
})

export const RoomListResponse = z.object({
  list: z.array(
    z.object({
      id: z.string().nonempty(),
      state: z.nativeEnum(GameState),
      startStateTs: z.number().positive(),
    }),
  ),
})

export const JoinRoomResponse = z.object({
  room: RoomResponse,
  channel: z.string().nonempty(),
})

export const RoomSumaryObject = z.object({
  group: z.string().nonempty(),
  idx: z.number().nonnegative(),
  user_id: z.string().nonempty(),
  data: z
    .object({
      type: z.enum(['text', 'image']),
      data: z.string().nonempty(),
    })
    .optional(),
})

export const RoomUserParam = RoomIdParams.extend({
  user_id: z.string().nonempty(),
})

export const RoomSumaryResponse = z.object({
  data: z.array(RoomSumaryObject),
})

export const RoomResultQuery = z.object({
  groupIdx: z.coerce.number(),
  round: z.coerce.number(),
})
