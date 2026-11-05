export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

export function createRoom(code) {
  return {
    code,
    board: Array(9).fill(null),
    players: { X: null, O: null },
    turn: 'X',
    status: 'waiting',
    result: null,
    rematch: { X: false, O: false },
    version: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function symbolFor(room, playerId) {
  if (room.players.X && room.players.X.id === playerId) return 'X'
  if (room.players.O && room.players.O.id === playerId) return 'O'
  return null
}

export function decideResult(board) {
  for (const line of LINES) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line }
    }
  }
  if (board.every((cell) => cell !== null)) {
    return { winner: 'draw', line: null }
  }
  return null
}

/** Room shape that is safe to send to the browser (no opponent player ids). */
export function publicRoom(room, playerId) {
  return {
    code: room.code,
    board: room.board,
    turn: room.turn,
    status: room.status,
    result: room.result,
    rematch: room.rematch,
    version: room.version,
    players: {
      X: room.players.X ? { name: room.players.X.name } : null,
      O: room.players.O ? { name: room.players.O.name } : null,
    },
    you: symbolFor(room, playerId),
  }
}

export function normalizeCode(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
}

export function normalizeName(value, fallback = 'Player') {
  const name = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24)
  return name || fallback
}
