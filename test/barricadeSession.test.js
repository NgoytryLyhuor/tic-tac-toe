import test from 'node:test'
import assert from 'node:assert/strict'
import { BarricadeSession } from '../src/lib/barricadeSession.js'

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

test('BarricadeSession two-player live online match synchronization', async (t) => {
  const code = `B${Date.now().toString(36).slice(-5).toUpperCase()}`
  let hostState = null
  let guestState = null

  const hostSession = new BarricadeSession({
    playerId: 'barricade-host-1',
    onState: (s) => { hostState = s },
  })

  const guestSession = new BarricadeSession({
    playerId: 'barricade-guest-2',
    onState: (s) => { guestState = s },
  })

  t.after(() => {
    hostSession.stop()
    guestSession.stop()
  })

  // 1. Host joins and becomes host
  await hostSession.join(code, 'AliceHost', 0)
  await waitFor(() => hostSession.isHost && hostState?.status === 'waiting')
  assert.ok(hostSession.isHost, 'First player must become host')
  assert.equal(hostState?.status, 'waiting')
  assert.equal(hostState?.you, 0)

  // 2. Guest joins with the same code
  await guestSession.join(code, 'BobGuest', 0)
  await waitFor(() => guestState?.status === 'playing' && hostState?.status === 'playing')

  assert.equal(hostState?.status, 'playing')
  assert.equal(guestState?.status, 'playing')
  assert.equal(guestState?.you, 1)
  assert.equal(hostState?.players[0].name, 'AliceHost')
  assert.equal(hostState?.players[1].name, 'BobGuest')
  assert.equal(hostState?.turn, 0, 'Host moves first in round 1')

  // 3. Host moves pawn from (8, 4) to (7, 4)
  const hostMoveRes = hostSession.movePawn(7, 4)
  assert.equal(hostMoveRes.ok, true)

  await waitFor(() => guestState?.pawns[0]?.row === 7 && guestState?.turn === 1)
  assert.deepEqual(guestState.pawns[0], { row: 7, col: 4 })
  assert.equal(guestState.turn, 1, 'Guest turn now')

  // 4. Guest drops a wall at (2, 2, 'H')
  const guestWallRes = guestSession.placeWall(2, 2, 'H')
  assert.equal(guestWallRes.ok, true)

  await waitFor(() => hostState?.walls?.length === 1 && hostState?.turn === 0)
  assert.equal(hostState.walls.length, 1)
  assert.deepEqual(hostState.walls[0], { row: 2, col: 2, orientation: 'H', placedBy: 1 })
  assert.equal(hostState.wallsLeft[1], 9)
  assert.equal(hostState.turn, 0, 'Turn back to Host')
})
