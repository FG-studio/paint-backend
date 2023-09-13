import { getLogger, makeUniqueId } from 'helpers'
import {
  GameConfig,
  GameState,
  IGameRoomDelegate,
  ResultData,
  UserInfo,
  UserRoundData,
} from './types'
import assert from 'assert'
import { modifyObject } from 'helpers/object'
import { readFileSync } from 'fs'
import path from 'path'

export class DrawGuestRoom {
  private _id: string = makeUniqueId()
  private _users: UserInfo[] = []
  private _hostId: string
  private _state: GameState = GameState.PENDING
  private _round: number = 0
  private _playerRoundData: Map<string, (UserRoundData | undefined)[]> =
    new Map()
  private _currentRoundOrder: string[] = []
  private _fixedRoundOrder: string[] = []
  private _startRoundTime: number
  private _endRoundExpected?: number
  private _roomInterval
  private _readyStateMap: Map<string, boolean>
  private _logger
  private _config: GameConfig = {
    maxPlayer: 8,
    reviewDuration: 10,
    drawDuration: 60,
    guestDuration: 30,
  }
  private _result: Array<ResultData> = []
  constructor(
    host: UserInfo,
    private _delegate?: IGameRoomDelegate,
    config?: GameConfig,
  ) {
    this._users.push(host)
    this._hostId = host.id
    this._logger = getLogger(`guest-room:${this._id}`)
    this._startRoundTime = Date.now()
    this._roomInterval = setInterval(this.roomNextRoundInterval, 1000)
    this._readyStateMap = new Map()
    this._readyStateMap.set(this._hostId, true)
    if (config) this._config = config
  }

  joinRoom = (user: UserInfo) => {
    if (this._state !== GameState.PENDING) {
      this._logger.error('Cannot join when game started')
      return
    }
    if (this._users.length > this._config.maxPlayer) {
      this._logger.error('Room is full')
      return
    }
    this._users.push(user)
    if (this._state === GameState.PENDING) {
      this._readyStateMap.set(user.id, true)
    }
    if (this._delegate) {
      this._delegate.onUserJoin(this._id, user)
    }
  }

  leaveRoom = (userId: string) => {
    const user = this._users.filter((u) => u.id === userId)
    if (user.length > 0) {
      this._users = this._users.filter((u) => u.id !== userId)
      if (this._delegate) {
        this._delegate.onUserLeave(this._id, user[0])
      }
    }
  }

  updateConfig = (userId: string, config: { [key: string]: any }) => {
    if (userId !== this._hostId) {
      this._logger.error(`user ${userId} who request start is not host`)
      throw new Error('ONLY HOST CAN START GAME')
    }
    this._config = modifyObject(this._config, config)
    if (this._delegate) {
      this._delegate.onConfigChanged(this._id, this._config)
    }
  }

  start = (userId: string, config?: GameConfig) => {
    if (userId !== this._hostId) {
      this._logger.error(`user ${userId} who request start is not host`)
      throw new Error('ONLY HOST CAN START GAME')
    }
    if (config) {
      this._config = config
    }
    this._logger.debug(this.users, 'user list')
    this._currentRoundOrder = this._users.map((u) => u.id)
    this._fixedRoundOrder = this._users.map((u) => u.id)
    for (const user of this._users) {
      this._playerRoundData.set(
        user.id,
        new Array(this._users.length).fill(undefined),
      )
    }
    this._logger.debug(this._fixedRoundOrder, 'fixed round order')
    this._logger.debug(this._currentRoundOrder, 'current round order')
    this.nextRound()
  }

  userSubmit = (userId: string, data: UserRoundData) => {
    this._logger.debug(data, `user ${userId} submit data`)
    const userRoundData = this._playerRoundData.get(userId)
    if (!userRoundData) {
      throw new Error('USER NOT FOUND IN ROOM')
    }

    userRoundData[this._round - 1] = data
    this._playerRoundData.set(userId, userRoundData)

    this.userReady(userId)
  }

  userUnsubmit = (userId: string) => {
    this.userUnready(userId)
  }

  get id(): string {
    return this._id
  }

  get users(): UserInfo[] {
    return this._users
  }

  get summaryData(): { [key: string]: (UserRoundData | undefined)[] } {
    const retval: { [key: string]: (UserRoundData | undefined)[] } = {}
    for (const [k, v] of this._playerRoundData.entries()) {
      retval[k] = v
    }
    return retval
  }

  get finalData(): Array<ResultData> {
    return this._result
  }

  get state(): GameState {
    return this._state
  }

  get stateStartTs(): number {
    return this._startRoundTime
  }

  get config(): GameConfig {
    return this._config
  }

  get json() {
    return {
      id: this._id,
      state: this._state,
      users: [...this.users.values()],
      show_order: [...this._fixedRoundOrder],
      config: this._config,
      host_id: this._hostId,
    }
  }

  get round() {
    return this._round
  }

  nextRound = () => {
    this._round += 1
    this._startRoundTime = Date.now()
    let changeRoundPayload:
      | { [key: string]: UserRoundData | undefined }
      | undefined = undefined
    this.unreadyAllUser()
    if (this._round === 1) {
      this._logger.debug(`change to question state`, this._round)
      this._state = GameState.QUESTION
      this._endRoundExpected =
        this._startRoundTime + (this._config.guestDuration + 1) * 1000
    } else if (this._round === this._fixedRoundOrder.length) {
      this._logger.debug(`change to guest state`, this._round)
      this._state = GameState.GUEST
      this._endRoundExpected =
        this._startRoundTime + (this._config.guestDuration + 1) * 1000
      this.shuffleUserOrder()
      changeRoundPayload = this.getPrevUserData()
    } else if (this._round === this._fixedRoundOrder.length + 1) {
      this._logger.debug(`change to sumary state`, this._round)
      this._state = GameState.SUMARY
      this._endRoundExpected = undefined
      this.shuffleUserOrder()
      this.buildResult()
      clearInterval(this._roomInterval)
    } else {
      this._logger.debug(`change to draw state`, this._round)
      this._state = GameState.DRAW
      this._endRoundExpected =
        this._startRoundTime +
        (this._config.reviewDuration + this._config.drawDuration + 1) * 1000
      this.shuffleUserOrder()
      changeRoundPayload = this.getPrevUserData()
    }

    this._logger.debug(this._currentRoundOrder, 'current round order')
    if (this._delegate) {
      this._delegate.onStateChange(this._id, {
        state: this._state,
        userData: changeRoundPayload,
        round: this._round,
      })
    }
  }

  nextResult = (userId: string, groupIdx: number, round: number) => {
    if (userId !== this._hostId) {
      throw new Error('action for only host')
    }
    const { idx, nextGroupIdx, nextRound } = this.getResultIdx(groupIdx, round)
    if (idx >= this._result.length) {
      throw new Error('NOT FOUND RESULT')
    }
    const result = this._result[idx]
    if (this._delegate) {
      this._delegate.onNextSumary(this._id, {
        result,
        next: {
          groupIdx: nextGroupIdx,
          round: nextRound,
        },
      })
    }

    return {
      nextGroupIdx,
      nextRound,
    }
  }

  private userReady = (userId: string) => {
    if (!this._readyStateMap.has(userId)) return

    this._readyStateMap.set(userId, true)
    if (this.isAllUserReady()) {
      this.nextRound()
    } else {
      if (this._delegate) {
        this._delegate.onUserStateChange(this._id, {
          userId: userId,
          ready: true,
        })
      }
    }
  }

  private userUnready = (userId: string) => {
    if (!this._readyStateMap.has(userId)) return

    this._readyStateMap.set(userId, false)
    if (this._delegate) {
      this._delegate.onUserStateChange(this._id, {
        userId: userId,
        ready: false,
      })
    }
  }

  private shuffleUserOrder = () => {
    const firstEl = this._currentRoundOrder.shift()
    assert(!!firstEl, 'current round order must exist')
    this._currentRoundOrder.push(firstEl)
  }

  private getPrevUserData = (): { [key: string]: UserRoundData } => {
    const retval: { [key: string]: UserRoundData } = {}
    const prevOrder = this.getPrevOrder()
    this._logger.debug(prevOrder, '[getPrevUserData] prev order')
    this._logger.debug(
      this._currentRoundOrder,
      '[getPrevUserData] current order ',
    )
    for (const idx in prevOrder) {
      const prevId = prevOrder[idx]
      const currId = this._currentRoundOrder[idx]
      const userData = this._playerRoundData.get(prevId)
      if (!userData) {
        retval[currId] = this.defaultUserData()
      } else {
        retval[currId] = userData[this._round - 2] || this.defaultUserData()
      }

      this._logger.debug(
        `[${this._round}]: send round data ${prevId} --> ${currId}`,
      )
    }

    return retval
  }

  private roomNextRoundInterval = () => {
    if (this._endRoundExpected) {
      const now = Date.now()
      if (now > this._endRoundExpected) {
        this.nextRound()
      }
    }
  }

  private defaultUserData = () => {
    const blankImage = readFileSync(
      path.join(process.cwd(), 'public', 'image', 'blank.png'),
    ).toString('base64')
    const data: UserRoundData = {
      type:
        this._round === 1 || this._round === this._fixedRoundOrder.length
          ? 'text'
          : 'image',
      data:
        this._round === 1 || this._round === this._fixedRoundOrder.length
          ? ''
          : `data:image/png;base64,${blankImage}`,
    }

    return data
  }

  private unreadyAllUser = () => {
    for (const k of this._readyStateMap.keys()) {
      this._readyStateMap.set(k, false)
    }
  }

  private isAllUserReady = () => {
    let retval = true
    for (const v of this._readyStateMap.values()) {
      retval = retval && v
    }
    return retval
  }

  private buildResult = () => {
    const retval: Array<ResultData> = []

    const orderData = [...this._fixedRoundOrder]
    for (let i = 0; i < this._fixedRoundOrder.length; i++) {
      const groupId = this._fixedRoundOrder[i]
      if (i !== 0) {
        const firstOrder = orderData.shift()
        assert(firstOrder, 'first order must exist')
        orderData.push(firstOrder)
      }

      for (let j = 0; j < orderData.length; j++) {
        const userId = orderData[j]
        const userData = this._playerRoundData.get(userId)
        if (userData && userData[j]) {
          retval.push({
            group: groupId,
            user_id: userId,
            idx: j,
            data: userData[j],
          })
        } else {
          retval.push({
            group: groupId,
            user_id: userId,
            idx: j,
            data: undefined,
          })
        }
      }
    }

    this._result = retval
  }

  private getPrevOrder = () => {
    const retval = [...this._currentRoundOrder]
    const last = retval.pop()
    assert(last, 'last element must exist')
    retval.unshift(last)
    return retval
  }

  private getResultIdx = (
    groupIdx: number,
    round: number,
  ): { idx: number; nextGroupIdx: number; nextRound: number } => {
    const idx = round + groupIdx * this._fixedRoundOrder.length
    let nextRound = round + 1
    let nextGroupIdx = groupIdx
    if (nextRound >= this._fixedRoundOrder.length) {
      nextRound = 0
      nextGroupIdx += 1
      if (nextGroupIdx >= this._fixedRoundOrder.length) {
        nextRound = -1
        nextGroupIdx = -1
      }
    }
    return {
      idx,
      nextGroupIdx,
      nextRound,
    }
  }
}
