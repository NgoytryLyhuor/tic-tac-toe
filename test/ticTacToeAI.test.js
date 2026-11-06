import test from 'node:test'
import assert from 'node:assert/strict'
import { getTicTacToeAIMove, getAvailableCells } from '../src/lib/ticTacToeAI.js'
import { decideResult } from '../src/lib/gameLogic.js'

test('AI takes immediate win', () => {
  // Board:
  // O | O | .
  // X | X | .
  // . | . | .
  const board = [
    'O', 'O', null,
    'X', 'X', null,
    null, null, null,
  ]
  const move = getTicTacToeAIMove(board, 'medium', 'O')
  assert.equal(move, 2, 'Bot O should take cell 2 to win')
})

test('AI blocks human immediate win', () => {
  // Board:
  // X | X | .
  // O | . | .
  // . | . | .
  const board = [
    'X', 'X', null,
    'O', null, null,
    null, null, null,
  ]
  const move = getTicTacToeAIMove(board, 'medium', 'O')
  assert.equal(move, 2, 'Bot O should block cell 2')
})

test('AI Master minimax returns valid legal move', () => {
  const board = Array(9).fill(null)
  board[0] = 'X'
  const move = getTicTacToeAIMove(board, 'master', 'O')
  assert.ok(move >= 0 && move <= 8)
  assert.equal(board[move], null)
})

test('AI Easy returns an available cell', () => {
  const board = [
    'X', 'O', 'X',
    'X', 'O', 'O',
    null, 'X', null,
  ]
  const move = getTicTacToeAIMove(board, 'easy', 'O')
  assert.ok(move === 6 || move === 8)
})

test('AI Master never loses when playing against random moves', () => {
  for (let game = 0; game < 15; game += 1) {
    const board = Array(9).fill(null)
    let turn = 'X' // Random player is X, Master bot is O
    let result = null

    while (!result) {
      if (turn === 'X') {
        const avail = getAvailableCells(board)
        if (avail.length === 0) break
        const chosen = avail[Math.floor(Math.random() * avail.length)]
        board[chosen] = 'X'
        turn = 'O'
      } else {
        const botMove = getTicTacToeAIMove(board, 'master', 'O')
        assert.ok(botMove !== null && board[botMove] === null)
        board[botMove] = 'O'
        turn = 'X'
      }
      result = decideResult(board)
    }

    // Master AI ('O') must never lose! Winner can only be 'O' or 'draw'
    assert.notEqual(result?.winner, 'X', `Master AI should never lose, but lost on game ${game}`)
  }
})
