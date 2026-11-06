import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyMovePawn,
  applyPlaceWall,
  createBarricadeRoom,
  hashId,
  normalizeCode,
  normalizeName,
  requestBarricadeRematch,
  resetBarricadeForWaiting,
  seatBarricadeGuest,
  toWireBarricadeRoom,
} from '../src/lib/barricadeLogic.js'

test('createBarricadeRoom initializes a waiting room', () => {
  const room = createBarricadeRoom('BARRICADE', 'host-123', 'Alice', 'token-abc')
  assert.equal(room.code, 'BARRICAD') // 8 chars max
  assert.equal(room.hostToken, 'token-abc')
  assert.equal(room.status, 'waiting')
  assert.equal(room.turn, 0)
  assert.equal(room.starter, 0)
  assert.equal(room.round, 1)
  assert.deepEqual(room.scores, { 0: 0, 1: 0 })
  assert.equal(room.wallsLeft[0], 10)
  assert.equal(room.wallsLeft[1], 10)
  assert.deepEqual(room.pawns[0], { row: 8, col: 4 })
  assert.deepEqual(room.pawns[1], { row: 0, col: 4 })
  assert.equal(room.players[0].name, 'Alice')
  assert.equal(room.players[1], null)
})

test('seatBarricadeGuest seats guest and transitions to playing', () => {
  const room = createBarricadeRoom('ROOM1', 'host-1', 'Host', 'token-1')
  const seated = seatBarricadeGuest(room, 'guest-2', 'Bob')
  assert.equal(seated, true)
  assert.equal(room.status, 'playing')
  assert.equal(room.players[1].id, 'guest-2')
  assert.equal(room.players[1].name, 'Bob')
  assert.equal(room.version, 2)

  // Cannot seat a second guest
  const seatedAgain = seatBarricadeGuest(room, 'guest-3', 'Charlie')
  assert.equal(seatedAgain, false)
})

test('toWireBarricadeRoom shapes wire payload securely', () => {
  const room = createBarricadeRoom('CODE99', 'host-id-42', 'HostPlayer', 't-99')
  seatBarricadeGuest(room, 'guest-id-77', 'GuestPlayer')

  const wire = toWireBarricadeRoom(room)
  assert.equal(wire.code, 'CODE99')
  assert.equal(wire.status, 'playing')
  assert.equal(wire.players[0].name, 'HostPlayer')
  assert.equal(wire.players[1].name, 'GuestPlayer')
  assert.equal(wire.players[0].id, undefined)
  assert.equal(wire.players[1].id, undefined)
  assert.equal(wire.seat1, hashId('guest-id-77'))
})

test('applyMovePawn and applyPlaceWall in online room flow', () => {
  const room = createBarricadeRoom('GAME1', 'p1', 'Alice', 't1')
  seatBarricadeGuest(room, 'p2', 'Bob')

  // Player 0 moves pawn up from (8, 4) to (7, 4)
  const res1 = applyMovePawn(room, 7, 4)
  assert.equal(res1.ok, true)
  assert.equal(room.turn, 1)
  assert.deepEqual(room.pawns[0], { row: 7, col: 4 })

  // Player 1 drops a horizontal wall at (3, 3)
  const res2 = applyPlaceWall(room, 3, 3, 'H')
  assert.equal(res2.ok, true)
  assert.equal(room.turn, 0)
  assert.equal(room.wallsLeft[1], 9)
  assert.equal(room.walls.length, 1)
})

test('fair alternating turns and score tracking on rematch', () => {
  const room = createBarricadeRoom('REMATCH1', 'p1', 'Alice', 't1')
  seatBarricadeGuest(room, 'p2', 'Bob')

  // Fast forward Player 0 to row 1, col 3 (empty adjacent goal cell at (0, 3))
  room.pawns[0] = { row: 1, col: 3 }
  room.turn = 0

  const winMove = applyMovePawn(room, 0, 3)
  assert.equal(winMove.ok, true)
  assert.equal(room.status, 'finished')
  assert.equal(room.winner, 0)
  assert.equal(room.scores[0], 1)
  assert.equal(room.scores[1], 0)

  // Rematch request by player 0 only
  const r0 = requestBarricadeRematch(room, 0)
  assert.equal(r0.ok, true)
  assert.equal(room.status, 'finished')
  assert.equal(room.rematch[0], true)
  assert.equal(room.rematch[1], false)

  // Player 1 also agrees to rematch -> Round 2 starts!
  const r1 = requestBarricadeRematch(room, 1)
  assert.equal(r1.ok, true)
  assert.equal(room.status, 'playing')
  assert.equal(room.round, 2)
  assert.equal(room.starter, 1) // Alternated from 0 to 1!
  assert.equal(room.turn, 1) // Player 1 starts round 2!
  assert.equal(room.winner, null)
  assert.deepEqual(room.pawns[0], { row: 8, col: 4 })
  assert.deepEqual(room.pawns[1], { row: 0, col: 4 })
  assert.equal(room.wallsLeft[0], 10)
  assert.equal(room.wallsLeft[1], 10)
  assert.equal(room.walls.length, 0)
  assert.deepEqual(room.scores, { 0: 1, 1: 0 }) // Scores persist!
})

test('resetBarricadeForWaiting resets room if guest leaves', () => {
  const room = createBarricadeRoom('RESET1', 'p1', 'Alice', 't1')
  seatBarricadeGuest(room, 'p2', 'Bob')
  assert.equal(room.status, 'playing')

  resetBarricadeForWaiting(room)
  assert.equal(room.status, 'waiting')
  assert.equal(room.players[1], null)
  assert.equal(room.round, 1)
  assert.equal(room.starter, 0)
  assert.equal(room.turn, 0)
})
