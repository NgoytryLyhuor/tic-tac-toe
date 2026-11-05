import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createRoom,
  seatGuest,
  applyMove,
  requestRematch,
  decideResult,
  LINES,
} from '../src/lib/gameLogic.js'

test('Alternating first player on rematch and score tracking', () => {
  const room = createRoom('TEST12', 'host-1', 'Alice', 'token-123')
  assert.equal(room.status, 'waiting')
  assert.equal(room.round, 1)
  assert.equal(room.starter, 'X')
  assert.equal(room.turn, 'X')

  // Guest joins
  const seated = seatGuest(room, 'guest-2', 'Bob')
  assert.equal(seated, true)
  assert.equal(room.status, 'playing')
  assert.equal(room.turn, 'X', 'Round 1 begins with X')
  assert.deepEqual(room.scores, { X: 0, O: 0, draws: 0 })

  // Round 1: X wins
  // Board:
  // X | X | X
  // O | O | .
  // . | . | .
  assert.ok(applyMove(room, 'X', 0).ok)
  assert.ok(applyMove(room, 'O', 3).ok)
  assert.ok(applyMove(room, 'X', 1).ok)
  assert.ok(applyMove(room, 'O', 4).ok)
  assert.ok(applyMove(room, 'X', 2).ok)

  assert.equal(room.status, 'finished')
  assert.equal(room.result.winner, 'X')
  assert.deepEqual(room.scores, { X: 1, O: 0, draws: 0 })

  // Request rematch
  assert.ok(requestRematch(room, 'X').ok)
  assert.equal(room.status, 'finished', 'Still finished until both agree')
  assert.ok(requestRematch(room, 'O').ok)

  // Round 2 must start!
  assert.equal(room.status, 'playing')
  assert.equal(room.round, 2)
  assert.equal(room.starter, 'O', 'Round 2 starter must be O')
  assert.equal(room.turn, 'O', 'Round 2 turn must be O')
  assert.deepEqual(room.scores, { X: 1, O: 0, draws: 0 }, 'Scores must be preserved')

  // In Round 2, X should NOT be able to move first!
  const invalidMove = applyMove(room, 'X', 0)
  assert.equal(invalidMove.ok, false)
  assert.match(invalidMove.error, /not your turn/i)

  // O moves first in Round 2
  assert.ok(applyMove(room, 'O', 4).ok)
  assert.equal(room.turn, 'X')
  assert.ok(applyMove(room, 'X', 0).ok)
  assert.equal(room.turn, 'O')

  // Now O wins Round 2
  // O at 4, 3, 5
  assert.ok(applyMove(room, 'O', 3).ok)
  assert.ok(applyMove(room, 'X', 1).ok)
  assert.ok(applyMove(room, 'O', 5).ok)

  assert.equal(room.status, 'finished')
  assert.equal(room.result.winner, 'O')
  assert.deepEqual(room.scores, { X: 1, O: 1, draws: 0 })

  // Rematch for Round 3
  assert.ok(requestRematch(room, 'O').ok)
  assert.ok(requestRematch(room, 'X').ok)

  assert.equal(room.status, 'playing')
  assert.equal(room.round, 3)
  assert.equal(room.starter, 'X', 'Round 3 starter alternates back to X')
  assert.equal(room.turn, 'X', 'Round 3 turn starts with X')
  assert.deepEqual(room.scores, { X: 1, O: 1, draws: 0 })
})

test('Draw round handles scores and alternates correctly', () => {
  const room = createRoom('DRAW99', 'h', 'H', 'tok')
  seatGuest(room, 'g', 'G')

  // X O X
  // X O O
  // O X X
  // 0:X, 1:O, 2:X, 4:O, 3:X, 5:O, 7:X, 6:O, 8:X
  const moves = [
    ['X', 0], ['O', 1],
    ['X', 2], ['O', 4],
    ['X', 3], ['O', 5],
    ['X', 7], ['O', 6],
    ['X', 8]
  ]
  for (const [sym, cell] of moves) {
    assert.ok(applyMove(room, sym, cell).ok)
  }

  assert.equal(room.status, 'finished')
  assert.equal(room.result.winner, 'draw')
  assert.deepEqual(room.scores, { X: 0, O: 0, draws: 1 })

  requestRematch(room, 'X')
  requestRematch(room, 'O')

  assert.equal(room.round, 2)
  assert.equal(room.starter, 'O')
  assert.equal(room.turn, 'O')
  assert.deepEqual(room.scores, { X: 0, O: 0, draws: 1 })
})
