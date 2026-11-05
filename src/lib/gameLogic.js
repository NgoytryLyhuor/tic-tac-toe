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

/** Stable, non-reversible fingerprint used to let a guest confirm its seat. */
export function hashId(value) {
  let hash = 2166136261
  const text = String(value ?? '')
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
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

export function createRoom(code, hostId, hostName, hostToken) {
  return {
    code,
    hostToken,
    board: Array(9).fill(null),
    players: { X: { id: hostId, name: hostName }, O: null },
    turn: 'X',
    round: 1,
    starter: 'X',
    scores: { X: 0, O: 0, draws: 0 },
    status: 'waiting',
    result: null,
    rematch: { X: false, O: false },
    version: 1,
    opponentOnline: false,
    createdAt: Date.now(),
  }
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

export function seatGuest(room, playerId, name) {
  if (room.players.O) return false

  room.players.O = { id: playerId, name: normalizeName(name, 'Player 2') }
  room.board = Array(9).fill(null)
  room.round = room.round || 1
  room.starter = room.starter || 'X'
  room.turn = room.starter
  room.scores = room.scores || { X: 0, O: 0, draws: 0 }
  room.status = 'playing'
  room.result = null
  room.rematch = { X: false, O: false }
  room.version += 1
  return true
}

export function applyMove(room, symbol, cell) {
  if (room.status === 'waiting') {
    return { ok: false, error: 'Waiting for an opponent to join.' }
  }
  if (room.status !== 'playing') {
    return { ok: false, error: 'This round is over. Start a rematch to play again.' }
  }
  if (room.turn !== symbol) {
    return { ok: false, error: "It's not your turn yet." }
  }

  const index = Number(cell)
  if (!Number.isInteger(index) || index < 0 || index > 8) {
    return { ok: false, error: 'Invalid square.' }
  }
  if (room.board[index] !== null) {
    return { ok: false, error: 'That square is already taken.' }
  }

  room.board[index] = symbol
  const result = decideResult(room.board)

  if (result) {
    room.status = 'finished'
    room.result = result
    room.rematch = { X: false, O: false }
    if (!room.scores) {
      room.scores = { X: 0, O: 0, draws: 0 }
    }
    if (result.winner === 'X') {
      room.scores.X = (room.scores.X || 0) + 1
    } else if (result.winner === 'O') {
      room.scores.O = (room.scores.O || 0) + 1
    } else if (result.winner === 'draw') {
      room.scores.draws = (room.scores.draws || 0) + 1
    }
  } else {
    room.turn = symbol === 'X' ? 'O' : 'X'
  }

  room.version += 1
  return { ok: true }
}

export function requestRematch(room, symbol) {
  if (room.status !== 'finished') {
    return { ok: false, error: 'Finish the current round first.' }
  }
  if (!room.players.X || !room.players.O) {
    return { ok: false, error: 'Waiting for an opponent to join.' }
  }

  room.rematch[symbol] = true

  if (room.rematch.X && room.rematch.O) {
    room.board = Array(9).fill(null)
    // Alternate starter each round for fairness!
    const nextStarter = (room.starter === 'X') ? 'O' : 'X'
    room.starter = nextStarter
    room.turn = nextStarter
    room.round = (room.round || 1) + 1
    room.status = 'playing'
    room.result = null
    room.rematch = { X: false, O: false }
  }

  room.version += 1
  return { ok: true }
}

export function resetForWaiting(room) {
  room.players.O = null
  room.board = Array(9).fill(null)
  room.round = 1
  room.starter = 'X'
  room.turn = 'X'
  room.scores = { X: 0, O: 0, draws: 0 }
  room.status = 'waiting'
  room.result = null
  room.rematch = { X: false, O: false }
  room.opponentOnline = false
  room.version += 1
}

/** Room shape published on the relay: no player ids, just names and a seat fingerprint. */
export function toWireRoom(room) {
  return {
    code: room.code,
    hostToken: room.hostToken,
    board: room.board,
    turn: room.turn,
    round: room.round || 1,
    starter: room.starter || 'X',
    scores: room.scores || { X: 0, O: 0, draws: 0 },
    status: room.status,
    result: room.result,
    rematch: room.rematch,
    version: room.version,
    opponentOnline: room.opponentOnline !== false,
    players: {
      X: room.players.X ? { name: room.players.X.name } : null,
      O: room.players.O ? { name: room.players.O.name } : null,
    },
    seatO: room.players.O ? hashId(room.players.O.id) : null,
  }
}
