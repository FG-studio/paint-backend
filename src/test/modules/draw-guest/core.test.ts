import { faker } from '@faker-js/faker'
import { addWithUpperLimit, makeUniqueId } from 'helpers'
import { DrawGuestRoom } from 'modules/draw-guest/core'
import {
  GameState,
  IGameRoomDelegate,
  OnStateChangeData,
  ResultData,
  UserInfo,
  UserRoundData,
} from 'modules/draw-guest/types'
import chai, { use } from 'chai'
import { listEntityToIdMap } from 'helpers/object'

async function gameExecute(
  maxPlayer = 6,
  getResultCb?: (data: {
    result: ResultData
    next: { groupIdx: number; round: number }
  }) => void,
): Promise<{
  users: Array<
    UserInfo & {
      roundData: UserRoundData[]
      getData: (UserRoundData | undefined)[]
    }
  >
  game: DrawGuestRoom
}> {
  let checksum = 0
  let game: DrawGuestRoom | undefined = undefined
  const userList: (UserInfo & {
    roundData: UserRoundData[]
    getData: (UserRoundData | undefined)[]
  })[] = new Array(maxPlayer).fill(undefined).map((_, idx) => {
    return {
      id: `${idx + 1}`,
      name: faker.person.fullName(),
      roundData: [],
      getData: [],
    }
  })
  const userMap = listEntityToIdMap(userList)
  const executeGame = (): Promise<void> => {
    return new Promise((resolve) => {
      const delegate: IGameRoomDelegate = {
        onConfigChanged: (config) => {},
        onStateChange: (id: string, state: OnStateChangeData) => {
          switch (state.state) {
            case GameState.QUESTION:
            case GameState.GUEST:
            case GameState.DRAW:
              if (state.userData) {
                // console.log(state.userData)
                for (const [k, v] of Object.entries(state.userData)) {
                  const user = userMap.get(k)
                  if (user) {
                    user.getData.push(v)
                  }
                }
              } else {
                for (const user of userList) {
                  user.getData.push(undefined)
                }
              }
              for (const user of userList) {
                generateRoundData(game!, user)
              }
              break
            case GameState.SUMARY:
              resolve()
              break
            default:
              break
          }
        },
        onUserJoin: (id, user) => {},
        onUserLeave: (id, user) => {},
        onUserStateChange: (id, data) => {},
        onNextSumary: (id, data) => {
          if (getResultCb) {
            getResultCb(data)
          }
        },
      }
      game = new DrawGuestRoom(userList[0], delegate, {
        drawDuration: 0.5,
        reviewDuration: 0.5,
        guestDuration: 0.5,
        maxPlayer,
      })
      const generateRoundData = (
        game: DrawGuestRoom,
        user: UserInfo & {
          roundData: UserRoundData[]
          getData: (UserRoundData | undefined)[]
        },
      ) => {
        const data: UserRoundData = {
          type: 'text',
          data: `${++checksum}`,
        }
        // console.log(`user ${user.id} submit data`, data)
        user.roundData.push(data)
        game.userSubmit(user.id, data)
      }
      for (let i = 1; i < userList.length; i++) {
        game.joinRoom({ id: userList[i].id, name: userList[i].name })
      }
      game.start(userList[0].id)
    })
  }
  await executeGame()
  return {
    users: userList,
    game: game!,
  }
}

describe('[unit test] Test guest and draw room', () => {
  it('game phase test', async () => {
    const host = {
      id: makeUniqueId(),
      name: faker.person.fullName(),
    }
    const phaseList: GameState[] = []
    const maxPlayer = 16
    const executeGame = (): Promise<void> => {
      return new Promise((resolve) => {
        const delegate: IGameRoomDelegate = {
          onConfigChanged: (config) => {},
          onStateChange: (id: string, state: OnStateChangeData) => {
            phaseList.push(state.state)
            if (state.state === GameState.SUMARY) {
              resolve()
            }
          },
          onUserJoin: (id, user) => {},
          onUserLeave: (id, user) => {},
          onUserStateChange: (id, data) => {},
          onNextSumary: (id, data) => {},
        }
        const game = new DrawGuestRoom(host, delegate, {
          drawDuration: 0.5,
          reviewDuration: 0.5,
          guestDuration: 0.5,
          maxPlayer,
        })

        for (let i = 0; i < 15; i++) {
          game.joinRoom({ id: makeUniqueId(), name: faker.person.fullName() })
        }
        game.start(host.id)
      })
    }

    await executeGame()
    // console.log(phaseList)
    chai
      .expect(phaseList.length, `game must have ${maxPlayer + 1} phase`)
      .equal(maxPlayer + 1)
    chai
      .expect(phaseList[0], `first phase is question phase`)
      .equal(GameState.QUESTION)
    chai
      .expect(phaseList[phaseList.length - 1], `last phase is sumary phase`)
      .equal(GameState.SUMARY)
    chai
      .expect(
        phaseList[phaseList.length - 2],
        `before last phase is answer phase`,
      )
      .equal(GameState.GUEST)
    chai
      .expect(
        phaseList[faker.number.int({ max: phaseList.length - 3, min: 1 })],
        `all the others phases are draw phase`,
      )
      .equal(GameState.DRAW)
  })

  it('user queue test', async () => {
    const gameInfo = await gameExecute(3)
    const userList = gameInfo.users

    // round order
    // A B C -> B C A -> C A B

    console.log(
      'user round data',
      userList.map((u) => u.roundData),
    )
    console.log(
      'user round received data',
      userList.map((u) => u.getData),
    )
    // for (let i = 0; i < userList.length; i++) {
    //   const user = userList[i]
    //   for (let round = 0; round < userList.length; round++) {
    //     const roundReceivedData = user.getData[round]
    //     if (round === 0)
    //       chai.expect(
    //         roundReceivedData,
    //         'data receive for first round is undefined',
    //       ).to.undefined
    //     else {
    //       const nextUserIdx = addWithUpperLimit(i, userList.length, round)
    //       const nextUser = userList[nextUserIdx]
    //       const data = nextUser.roundData[round - 1]
    //       chai
    //         .expect(
    //           JSON.stringify(roundReceivedData),
    //           `round ${round} user ${i} received from user ${nextUserIdx}`,
    //         )
    //         .equal(JSON.stringify(data))
    //     }
    //   }
    // }
  })

  it('sumary check', async () => {
    const gameData = await gameExecute(3)
    const game = gameData.game
    const userList = gameData.users
    const sumary = game.finalData
    const userResult: { [key: string]: (UserRoundData | undefined)[] } = {}
    for (const el of sumary) {
      const { user_id, data } = el
      let sumaryData = userResult[user_id]
      if (!sumaryData) {
        sumaryData = []
      }
      sumaryData.push(data)
      userResult[user_id] = sumaryData
    }

    for (const user of userList) {
      const userSumary = userResult[user.id]
      chai.expect(userSumary, `data sumary of user ${user.id} must exist`).not
        .undefined
      chai
        .expect(
          userSumary.sort((a, b) => (a!.data < b!.data ? 1 : -1)),
          `data sumary of user ${user.id} must same with user send data`,
        )
        .eql(user.roundData.sort((a, b) => (a!.data < b!.data ? 1 : -1)))
    }
  })

  it('game result check', async () => {
    const results: ResultData[] = []
    const { game, users } = await gameExecute(3, (data) =>
      results.push(data.result),
    )
    let groupIdx = 0
    let round = 0
    while (groupIdx > -1 && round > -1) {
      const idxData = game.nextResult(users[0].id, groupIdx, round)
      groupIdx = idxData.nextGroupIdx
      round = idxData.nextRound
    }

    console.log(game.finalData)
    console.log(results)
  })
})
