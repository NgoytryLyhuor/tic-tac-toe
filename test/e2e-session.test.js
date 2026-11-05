import test from 'node:test'
import assert from 'node:assert/strict'
import { GameSession } from '../src/lib/gameSession.js'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(fn, maxTries = 40, interval = 100) {
  for (let i = 0; i < maxTries; i += 1) {
    if (fn()) return true
    await wait(interval)
  }
  return fn()
}

test('GameSession two-player fair rematch flow', async (t) => {
  const code = `T${Date.now().toString(36).slice(-5).toUpperCase()}`
  let hostState = null
  let guestState = null

  const hostSession = new GameSession({
    playerId: 'host-player-id-1',
    onState: (s) => { hostState = s },
  })

  const guestSession = new GameSession({
    playerId: 'guest-player-id-2',
    onState: (s) => { guestState = s },
  })

  t.after(() => {
    hostSession.stop()
    guestSession.stop()
  })

  // 1. Host joins
  await hostSession.join(code, 'HostAlice', 0)
  await waitFor(() => hostSession.isHost && hostState?.status === 'waiting')
  assert.ok(hostSession.isHost, 'Should become host')
  assert.equal(hostState.status, 'waiting')

  // 2. Guest joins
  await guestSession.join(code, 'GuestBob', 0)
  await waitFor(() => guestState?.status === 'playing' && hostState?.status === 'playing')

  assert.equal(hostState.status, 'playing')
  assert.equal(guestState.status, 'playing')
  assert.equal(hostState.round, 1)
  assert.equal(hostState.starter, 'X')
  assert.equal(hostState.turn, 'X', 'Host starts round 1')

  // Round 1: X moves 0, O moves 3, X moves 1, O moves 4, X moves 2 (X wins)
  assert.ok(hostSession.move(0).ok)
  await waitFor(() => guestState?.turn === 'O')
  assert.ok(guestSession.move(3).ok)

  await waitFor(() => hostState?.turn === 'X' && hostState?.board[3] === 'O')
  assert.ok(hostSession.move(1).ok)

  await waitFor(() => guestState?.turn === 'O' && guestState?.board[1] === 'X')
  assert.ok(guestSession.move(4).ok)

  await waitFor(() => hostState?.turn === 'X' && hostState?.board[4] === 'O')
  assert.ok(hostSession.move(2).ok)

  await waitFor(() => hostState?.status === 'finished' && guestState?.status === 'finished')

  assert.equal(hostState.result?.winner, 'X')
  assert.equal(guestState.result?.winner, 'X')
  assert.equal(hostState.scores?.X, 1)
  assert.equal(guestState.scores?.X, 1)

  // 3. Both rematch
  hostSession.rematch()
  guestSession.rematch()

  await waitFor(
    () =>
      hostState?.status === 'playing' && hostState?.round === 2 &&
      guestState?.status === 'playing' && guestState?.round === 2
  )

  assert.equal(hostState.round, 2, 'Must be Round 2')
  assert.equal(hostState.starter, 'O', 'Round 2 starter must be Guest O')
  assert.equal(hostState.turn, 'O', 'Round 2 first move must belong to Guest O')
  assert.equal(guestState.turn, 'O', 'Guest also sees turn is O')

  // In Round 2, Host moving first should be rejected by Host
  const badHostMove = hostSession.move(0)
  assert.equal(badHostMove.ok, false)

  // Guest moving first should succeed
  const guestMove = guestSession.move(4)
  assert.ok(guestMove.ok, 'Guest moves first successfully')

  await waitFor(() => hostState?.board[4] === 'O')
  assert.equal(hostState.board[4], 'O', 'Host receives Guest move at 4')
  assert.equal(hostState.turn, 'X', 'Now it is Host turn')
})
