import { LINES, decideResult } from './gameLogic.js'

/**
 * Intelligent AI for Tic Tac Toe.
 * Supports Easy, Medium, and Master (Minimax).
 */

export function getAvailableCells(board) {
  const cells = []
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === null) cells.push(i)
  }
  return cells
}

/** Random available cell */
function getRandomMove(board) {
  const available = getAvailableCells(board)
  if (available.length === 0) return null
  const idx = Math.floor(Math.random() * available.length)
  return available[idx]
}

/** Check if a symbol can win in 1 move, return winning cell or null */
function findWinningMove(board, symbol) {
  for (const line of LINES) {
    const [a, b, c] = line
    const vals = [board[a], board[b], board[c]]
    const countSym = vals.filter((v) => v === symbol).length
    const countEmpty = vals.filter((v) => v === null).length
    if (countSym === 2 && countEmpty === 1) {
      if (board[a] === null) return a
      if (board[b] === null) return b
      if (board[c] === null) return c
    }
  }
  return null
}

/** Minimax algorithm for Master difficulty */
function minimax(board, isMaximizing, botSymbol, humanSymbol, depth = 0) {
  const res = decideResult(board)
  if (res) {
    if (res.winner === botSymbol) return 10 - depth
    if (res.winner === humanSymbol) return depth - 10
    if (res.winner === 'draw') return 0
  }

  const available = getAvailableCells(board)
  if (available.length === 0) return 0

  if (isMaximizing) {
    let bestScore = -Infinity
    for (const cell of available) {
      board[cell] = botSymbol
      const score = minimax(board, false, botSymbol, humanSymbol, depth + 1)
      board[cell] = null
      bestScore = Math.max(score, bestScore)
    }
    return bestScore
  } else {
    let bestScore = Infinity
    for (const cell of available) {
      board[cell] = humanSymbol
      const score = minimax(board, true, botSymbol, humanSymbol, depth + 1)
      board[cell] = null
      bestScore = Math.min(score, bestScore)
    }
    return bestScore
  }
}

/** Get best Minimax move */
function getMinimaxMove(board, botSymbol = 'O') {
  const humanSymbol = botSymbol === 'X' ? 'O' : 'X'
  const available = getAvailableCells(board)
  if (available.length === 0) return null

  // If opening move or empty center, take center for speed
  if (board[4] === null && Math.random() < 0.7) return 4

  let bestMove = available[0]
  let bestScore = -Infinity

  for (const cell of available) {
    board[cell] = botSymbol
    const score = minimax(board, false, botSymbol, humanSymbol, 0)
    board[cell] = null

    if (score > bestScore) {
      bestScore = score
      bestMove = cell
    }
  }

  return bestMove
}

/** Main API: returns cell index (0..8) */
export function getTicTacToeAIMove(board, difficulty = 'medium', botSymbol = 'O') {
  const humanSymbol = botSymbol === 'X' ? 'O' : 'X'
  const available = getAvailableCells(board)
  if (available.length === 0) return null

  if (difficulty === 'easy') {
    return getRandomMove(board)
  }

  if (difficulty === 'medium') {
    // 1. Win if possible
    const winCell = findWinningMove(board, botSymbol)
    if (winCell !== null) return winCell

    // 2. Block human win
    const blockCell = findWinningMove(board, humanSymbol)
    if (blockCell !== null) return blockCell

    // 3. Take center if open
    if (board[4] === null && Math.random() < 0.7) return 4

    // 4. Random available
    return getRandomMove(board)
  }

  // Master difficulty: Minimax
  return getMinimaxMove(board, botSymbol)
}

