import test from 'node:test'
import assert from 'node:assert/strict'
import { GameSession } from '../src/lib/gameSession.js'
import { saveHostSession, loadHostSession, clearHostSession } from '../src/lib/player.js'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test('Host can resume session without dropping match', async (t) => {
  // Mock sessionStorage in node
  const storage = new Map()
  global.sessionStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  }

  const code = `R${Date.now().toString(36).slice(-5).toUpperCase()}`
  let hostState = null

  const hostSession1 = new GameSession({
    playerId: 'host-player-id-1',
    onState: (s) => { hostState = s },
  })

  t.after(() => {
    hostSession1.stop()
    delete global.sessionStorage
  })

  // 1. Host creates match
  await hostSession1.join(code, 'HostAlice', 0)
  for (let i = 0; i < 30; i += 1) {
    if (hostSession1.isHost && hostState) break
    await wait(100)
  }
  assert.ok(hostSession1.isHost)
  assert.equal(hostState.code, code)

  const originalToken = hostSession1.hostToken
  assert.ok(originalToken)

  // Verify host session was saved in sessionStorage
  const saved = loadHostSession(code)
  assert.ok(saved)
  assert.equal(saved.hostToken, originalToken)

  // Simulate page refresh: stop old session without leaving
  hostSession1.stop()

  // 2. Host rejoins the same room (like on page refresh)
  let hostState2 = null
  const hostSession2 = new GameSession({
    playerId: 'host-player-id-1',
    onState: (s) => { hostState2 = s },
  })

  t.after(() => {
    hostSession2.stop()
  })

  await hostSession2.join(code, 'HostAlice', 0)

  // Must resume instantly as host with the same token!
  assert.equal(hostSession2.isHost, true, 'Must instantly resume as host')
  assert.equal(hostSession2.hostToken, originalToken, 'Must keep the same host token')
  assert.equal(hostState2.code, code)
})
