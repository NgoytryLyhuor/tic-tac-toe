import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createBarricadeState,
  getLegalMoves,
  applyMovePawn,
  applyPlaceWall,
  isValidWallPlacement,
  getBestAIMove,
  findPath,
} from '../src/lib/barricadeLogic.js'

test('Barricade initial state', () => {
  const state = createBarricadeState('ai', 'medium')
  assert.equal(state.pawns[0].row, 8)
  assert.equal(state.pawns[0].col, 4)
  assert.equal(state.pawns[1].row, 0)
  assert.equal(state.pawns[1].col, 4)
  assert.deepEqual(state.wallsLeft, [10, 10])
  assert.equal(state.turn, 0)
  assert.equal(state.winner, null)
})

test('Basic legal moves from start', () => {
  const state = createBarricadeState('ai', 'medium')
  const moves = getLegalMoves(state, 0)
  // From (8, 4), can move Up (7, 4), Left (8, 3), Right (8, 5)
  assert.equal(moves.length, 3)
  assert.ok(moves.some((m) => m.row === 7 && m.col === 4))
  assert.ok(moves.some((m) => m.row === 8 && m.col === 3))
  assert.ok(moves.some((m) => m.row === 8 && m.col === 5))
})

test('Face to face straight jump', () => {
  const state = createBarricadeState('pass')
  state.pawns[0] = { row: 4, col: 4 }
  state.pawns[1] = { row: 3, col: 4 }
  state.turn = 0

  const moves = getLegalMoves(state, 0)
  // Straight jump over opponent (3, 4) lands on (2, 4)
  const jump = moves.find((m) => m.row === 2 && m.col === 4)
  assert.ok(jump, 'Should have straight jump to (2, 4)')
  assert.equal(jump.type, 'jump')
})

test('Diagonal jump when straight jump is blocked by a wall', () => {
  const state = createBarricadeState('pass')
  state.pawns[0] = { row: 4, col: 4 }
  state.pawns[1] = { row: 3, col: 4 }
  state.turn = 0

  // Place horizontal wall at (2, 4) blocking straight jump to (2, 4)
  state.walls.push({ row: 2, col: 4, orientation: 'H', placedBy: 1 })

  const moves = getLegalMoves(state, 0)
  // Straight jump (2, 4) should NOT be possible
  assert.ok(!moves.some((m) => m.row === 2 && m.col === 4))

  // Diagonal jumps around opponent to (3, 3) and (3, 5) must be legal
  assert.ok(moves.some((m) => m.row === 3 && m.col === 3 && m.type === 'diagonal'))
  assert.ok(moves.some((m) => m.row === 3 && m.col === 5 && m.type === 'diagonal'))
})

test('Golden Rule: Cannot completely trap a player with a wall', () => {
  const state = createBarricadeState('pass')
  // Surround player 0 at (8, 0)
  state.pawns[0] = { row: 8, col: 0 }
  state.walls.push({ row: 7, col: 0, orientation: 'H', placedBy: 1 }) // blocks going up to (7,0)

  // Try placing a vertical wall that seals column 0 entirely
  // Trying to block to the right: vertical wall at (7, 0) or (8, 0)
  const canTrap = isValidWallPlacement(state, 7, 0, 'V')
  assert.equal(canTrap, false, 'Wall that leaves zero paths to goal must be rejected')
})

test('Win detection upon reaching target baseline', () => {
  const state = createBarricadeState('pass')
  state.pawns[0] = { row: 1, col: 4 }
  state.pawns[1] = { row: 0, col: 0 } // Opponent elsewhere
  state.turn = 0

  const res = applyMovePawn(state, 0, 4)
  assert.ok(res.ok)
  assert.equal(state.winner, 0, 'Player 0 reaches row 0 and wins')
})

test('AI generates valid moves', () => {
  const state = createBarricadeState('ai', 'hard')
  state.turn = 1 // Bot turn
  const action = getBestAIMove(state, 'hard')
  assert.ok(action)
  assert.ok(action.type === 'move' || action.type === 'wall')
})
