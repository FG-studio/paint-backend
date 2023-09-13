import { makeUniqueId } from 'helpers'
import { LocalPubsub, MsgBusCallback } from 'modules/pubsub'
import { RawData, WebSocket } from 'ws'

class Agent {
  private _id: string = makeUniqueId()
  private _channelMap: Map<string, string> = new Map()
  constructor(
    private _ws: WebSocket,
    private _roomId: string,
    private _userId: string,
    private _onSocketClose?: (id: string) => void,
  ) {
    this._ws.on('close', this.onDisconnect)
    this._ws.on('message', this.onMessage)
    this._ws.on('error', this.onError)
    this.init()
  }

  init = () => {
    this.subcribe(`room.${this._roomId}`, this.send) //room channel
    this.subcribe(`room.${this._roomId}.user.${this._userId}`, this.send) //private channel
  }

  get id(): string {
    return this._id
  }

  send = (data: any) => {
    if (this._ws.readyState === WebSocket.CLOSED) {
      return
    }

    this._ws.send(JSON.stringify(data))
  }

  onMessage = (data: RawData) => {
    if (data.toString() === 'ping') {
      this._ws.send('pong')
    }
  }

  onDisconnect = () => {
    this.destroy()
  }

  onError = () => {
    this.destroy()
  }

  destroy = () => {
    for (const [k, v] of this._channelMap.entries()) {
      LocalPubsub.Instance.unregister(k, v)
    }

    if (this._onSocketClose) {
      this._onSocketClose(this._id)
    }
  }

  private subcribe = (channel: string, cb: MsgBusCallback) => {
    const channelId = LocalPubsub.Instance.register(channel, cb)
    this._channelMap.set(channel, channelId)
  }
}

export class AgentController {
  private static _ins: AgentController | undefined
  public static get Instance(): AgentController {
    if (!this._ins) {
      this._ins = new AgentController()
    }
    return this._ins
  }
  private _agentMap: Map<string, Agent>
  private constructor() {
    this._agentMap = new Map()
  }

  onConnect = (ws: WebSocket, roomId: string, userId: string) => {
    const agent = new Agent(ws, roomId, userId, this.onDisconnect)
    this._agentMap.set(agent.id, agent)
  }

  onDisconnect = (agentId: string): void => {
    this._agentMap.delete(agentId)
  }
}
