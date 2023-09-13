import assert from 'assert'
import { STORAGE_ENDPOINT, WS_ENDPOINT } from 'config'
import { HOUR, SEC, getLogger, makeUniqueId } from 'helpers'
import { DrawGuestRoom } from 'modules/draw-guest/core'
import {
  GameConfig,
  GameState,
  IGameRoomDelegate,
  OnStateChangeData,
  ResultData,
  UserInfo,
  UserStateData,
} from 'modules/draw-guest/types'
import { LocalPubsub } from 'modules/pubsub'
import {
  ErrorCode,
  RoomResultQuery,
  RoomUpdateConfig,
  SystemError,
  UserSubmitData,
} from 'server/schema'
import { z } from 'zod'
import sharp from 'sharp'
import { StorageController } from 'modules/storage'
import { readFileSync } from 'fs'
import path from 'path'

type RoomEvent<T> = {
  channel: string
  type:
    | 'user_join'
    | 'user_leave'
    | 'config_changed'
    | 'state_changed'
    | 'user_state_changed'
    | 'next_sumary'
  data: T
}

export class RoomManager implements IGameRoomDelegate {
  private static _ins: RoomManager | undefined
  static get Instance(): RoomManager {
    if (!this._ins) {
      this._ins = new RoomManager()
    }
    return this._ins
  }
  private _roomMap: Map<string, DrawGuestRoom>
  private _logger
  private _interval

  private constructor() {
    this._logger = getLogger('room-manager')
    this._roomMap = new Map()
    this._interval = setInterval(this.roomClear, 5 * SEC)
  }

  createRoom = (host: UserInfo) => {
    const room = new DrawGuestRoom(host, this)
    this._roomMap.set(room.id, room)
    const pubsubEndpoint = `${WS_ENDPOINT}/ws?room=${room.id}&user_id=${host.id}`

    return {
      room: room.json,
      channel: pubsubEndpoint,
    }
  }

  joinRoom = (roomId: string, user: UserInfo) => {
    const room = this.findRoom(roomId)

    room.joinRoom(user)
    const pubsubEndpoint = `${WS_ENDPOINT}/ws?room=${room.id}&user_id=${user.id}`

    return {
      room: room.json,
      channel: pubsubEndpoint,
    }
  }

  leaveRoom = (roomId: string, userId: string) => {
    const room = this.findRoom(roomId)
    room.leaveRoom(userId)

    return {
      status: true,
    }
  }

  unReady = (roomId: string, userId: string) => {
    const room = this.findRoom(roomId)
    room.userUnsubmit(userId)

    return {
      status: true,
    }
  }

  getRoom = (roomId: string) => {
    const room = this.findRoom(roomId)
    return room.json
  }

  updateRoomConfig = (
    roomId: string,
    userId: string,
    config: z.infer<typeof RoomUpdateConfig>,
  ) => {
    const room = this.findRoom(roomId)
    room.updateConfig(userId, config)
    return room.config
  }

  startRoom = (roomId: string, userId: string) => {
    try {
      const room = this.findRoom(roomId)
      room.start(userId)

      return true
    } catch (e) {
      throw new SystemError(ErrorCode.VALIDATION_ERROR, (e as Error).message)
    }
  }

  submitRoundData = async (
    roomId: string,
    data: z.infer<typeof UserSubmitData>,
  ) => {
    const room = this.findRoom(roomId)
    let payloadData = data.payload.data
    if (data.payload.type === 'image') {
      payloadData = await this.convertImage(
        roomId,
        data.user_id,
        room.round,
        data.payload.data,
      )
    }
    room.userSubmit(data.user_id, {
      ...data.payload,
      data: payloadData,
    })
    return true
  }

  listRoom = () => {
    const retval = []
    for (const v of this._roomMap.values()) {
      retval.push({
        id: v.id,
        state: v.state,
        startStateTs: v.stateStartTs,
      })
    }

    return {
      list: retval,
    }
  }

  getRoomSumary = (roomId: string) => {
    const room = this.findRoom(roomId)
    const data = room.finalData

    return { data }
  }

  nextResult = (
    roomId: string,
    userId: string,
    query: z.infer<typeof RoomResultQuery>,
  ) => {
    const room = this.findRoom(roomId)
    const next = room.nextResult(userId, query.groupIdx, query.round)

    return {
      groupIdx: next.nextGroupIdx,
      round: next.nextRound,
    }
  }

  onUserJoin(id: string, user: UserInfo): void {
    this.boardcast(id, 'user_join', user)
  }

  onUserLeave(id: string, user: UserInfo): void {
    this.boardcast(id, 'user_leave', user)
  }

  onConfigChanged(id: string, config: GameConfig): void {
    this.boardcast(id, 'config_changed', config)
  }

  onNextSumary(
    id: string,
    data: { result: ResultData; next: { groupIdx: number; round: number } },
  ): void {
    this.boardcast(id, 'next_sumary', data)
  }

  onStateChange(id: string, data: OnStateChangeData): void {
    switch (data.state) {
      case GameState.DRAW:
      case GameState.GUEST: {
        assert(
          !!data.userData,
          `user data for state changed in draw state and guest state must exist`,
        )
        this._logger.debug(data.userData)
        for (const [userId, userData] of Object.entries(data.userData)) {
          this._logger.debug(userData, `send data to user ${userId}`)
          this.privateSend(id, userId, 'state_changed', {
            state: data.state,
            round: data.round,
            userData,
          })
        }
        break
      }
      default:
        this.boardcast(id, 'state_changed', data)
        break
    }
  }

  onUserStateChange(id: string, data: UserStateData): void {
    this.boardcast(id, 'user_state_changed', data)
  }

  private convertImage = async (
    roomId: string,
    userId: string,
    round: number,
    src: string,
  ): Promise<string> => {
    let data = src.includes(';base64,') ? src.split(';base64,')[1] : src
    if (data === '') {
      const blankImage = readFileSync(
        path.join(process.cwd(), 'public', 'image', 'blank.png'),
      ).toString('base64')
      data = `${blankImage}`
    }
    const imageData = await sharp(Buffer.from(data, 'base64'))
      .resize({
        width: 1280,
        height: 1024,
        fit: 'contain',
      })
      .png()
      .toBuffer()
    const fpath = `${roomId}/${round}/${userId}/${makeUniqueId()}.png`
    const storage = new StorageController(STORAGE_ENDPOINT)
    await storage.putFile(imageData, fpath, { 'Content-Type': 'image/png' })
    return storage.getPublicLink(fpath)
  }

  private boardcast = (
    roomId: string,
    type:
      | 'user_join'
      | 'user_leave'
      | 'config_changed'
      | 'state_changed'
      | 'user_state_changed'
      | 'next_sumary',
    data: any,
  ) => {
    const roomChannel = `room.${roomId}`
    LocalPubsub.Instance.publish(roomChannel, {
      channel: roomChannel,
      type,
      data,
    } as RoomEvent<any>)
  }

  private privateSend = (
    roomId: string,
    userId: string,
    type:
      | 'user_join'
      | 'user_leave'
      | 'config_changed'
      | 'state_changed'
      | 'user_state_changed'
      | 'next_sumary',
    data: any,
  ) => {
    const userChannel = `room.${roomId}.user.${userId}`
    LocalPubsub.Instance.publish(userChannel, {
      channel: userChannel,
      type,
      data,
    })
  }

  private findRoom = (roomId: string): DrawGuestRoom => {
    const room = this._roomMap.get(roomId)
    if (!room) {
      throw new SystemError(ErrorCode.ENTITY_NOT_FOUND, 'ROOM_NOT_FOUND')
    }
    return room
  }

  private roomClear = () => {
    for (const [k, v] of this._roomMap.entries()) {
      if (v.state === GameState.SUMARY && v.stateStartTs - Date.now() > HOUR) {
        this._roomMap.delete(k)
      }
    }
  }
}
