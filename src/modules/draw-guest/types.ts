export type UserInfo = {
  id: string
  name: string
  isHost?: boolean
}

export type UserRoundData = {
  type: 'text' | 'image'
  data: string
}

export type UserStateData = {
  userId: string
  ready: boolean
}

export type GameConfig = {
  maxPlayer: number
  reviewDuration: number
  drawDuration: number
  guestDuration: number
}

export enum GameState {
  PENDING = 0,
  QUESTION,
  DRAW,
  GUEST,
  SUMARY,
}

export type OnStateChangeData = {
  state: GameState
  round: number
  userData?: { [key: string]: UserRoundData | undefined }
}

export type ResultData = {
  group: string
  idx: number
  user_id: string
  data: UserRoundData | undefined
}

export interface IGameRoomDelegate {
  onUserJoin(id: string, user: UserInfo): void
  onUserLeave(id: string, user: UserInfo): void
  onConfigChanged(id: string, config: GameConfig): void
  onStateChange(id: string, data: OnStateChangeData): void
  onUserStateChange(id: string, data: UserStateData): void
  onNextSumary(
    id: string,
    data: { result: ResultData; next: { groupIdx: number; round: number } },
  ): void
}
