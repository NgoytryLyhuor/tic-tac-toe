/**
 * Pure, authoritative logic engine for Barricade / Quoridor.
 * 9x9 grid, 10 walls per player.
 * Player 0 (Bottom/Red): starts at (8, 4), goal is row 0.
 * Player 1 (Top/Blue): starts at (0, 4), goal is row 8.
 */

export const BOARD_SIZE = 9
export const INITIAL_WALLS = 10

export function createBarricadeState(mode = 'ai', difficulty = 'medium') {
  return {
    mode, // 'ai' | 'pass' | 'online'
    difficulty, // 'easy' | 'medium' | 'hard'
    pawns: [
      { row: 8, col: 4 }, // Player 0 (Bottom)
      { row: 0, col: 4 }, // Player 1 (Top)
    ],
    wallsLeft: [INITIAL_WALLS, INITIAL_WALLS],
    walls: [], // Array of { row, col, orientation: 'H' | 'V', placedBy: 0 | 1 }
    turn: 0, // 0 = Player 0, 1 = Player 1
    winner: null, // null | 0 | 1
    moveHistory: [],
    version: 1,
  }
}

/** Check if moving between (r1, c1) and adjacent (r2, c2) is blocked by a wall */
export function isWallBetween(walls, r1, c1, r2, c2) {
  // Horizontal movement between columns c1 and c2
  if (r1 === r2) {
    const r = r1
    const minC = Math.min(c1, c2)
    // A vertical wall at (r, minC) or (r-1, minC) blocks horizontal passage
    return walls.some(
      (w) =>
        w.orientation === 'V' &&
        w.col === minC &&
        (w.row === r || w.row === r - 1),
    )
  }

  // Vertical movement between rows r1 and r2
  if (c1 === c2) {
    const c = c1
    const minR = Math.min(r1, r2)
    // A horizontal wall at (minR, c) or (minR, c-1) blocks vertical passage
    return walls.some(
      (w) =>
        w.orientation === 'H' &&
        w.row === minR &&
        (w.col === c || w.col === c - 1),
    )
  }

  return true // Diagonal or non-adjacent is blocked by default
}

/** Check if two adjacent cells can pass to each other */
export function canPass(walls, r1, c1, r2, c2) {
  if (
    r2 < 0 ||
    r2 >= BOARD_SIZE ||
    c2 < 0 ||
    c2 >= BOARD_SIZE ||
    r1 < 0 ||
    r1 >= BOARD_SIZE ||
    c1 < 0 ||
    c1 >= BOARD_SIZE
  ) {
    return false
  }
  return !isWallBetween(walls, r1, c1, r2, c2)
}

/** BFS Pathfinding: returns shortest path array of { row, col } or null if trapped */
export function findPath(pawns, walls, playerIndex) {
  const start = pawns[playerIndex]
  const targetRow = playerIndex === 0 ? 0 : 8

  const queue = [[start]]
  const visited = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(false),
  )
  visited[start.row][start.col] = true

  const deltas = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]

  while (queue.length > 0) {
    const path = queue.shift()
    const curr = path[path.length - 1]

    if (curr.row === targetRow) {
      return path
    }

    for (const [dr, dc] of deltas) {
      const nr = curr.row + dr
      const nc = curr.col + dc

      if (
        nr >= 0 &&
        nr < BOARD_SIZE &&
        nc >= 0 &&
        nc < BOARD_SIZE &&
        !visited[nr][nc] &&
        canPass(walls, curr.row, curr.col, nr, nc)
      ) {
        visited[nr][nc] = true
        queue.push([...path, { row: nr, col: nc }])
      }
    }
  }

  return null // Trapped!
}

/** Check if a wall placement is valid */
export function isValidWallPlacement(state, row, col, orientation) {
  // Walls span 2 cells, intersection must be in [0..7, 0..7]
  if (row < 0 || row > 7 || col < 0 || col > 7) return false
  if (orientation !== 'H' && orientation !== 'V') return false

  const player = state.turn
  if (state.wallsLeft[player] <= 0) return false
  if (state.winner !== null) return false

  // Check collision with existing walls
  for (const w of state.walls) {
    // Exact same position & orientation
    if (w.row === row && w.col === col) return false

    // Overlapping horizontal wall (shares same row, adjacent column)
    if (orientation === 'H' && w.orientation === 'H' && w.row === row) {
      if (Math.abs(w.col - col) < 2) return false
    }

    // Overlapping vertical wall (shares same col, adjacent row)
    if (orientation === 'V' && w.orientation === 'V' && w.col === col) {
      if (Math.abs(w.row - row) < 2) return false
    }
  }

  // Golden Rule check: Neither player can be trapped (must have path to goal)
  const candidateWalls = [...state.walls, { row, col, orientation, placedBy: player }]
  const path0 = findPath(state.pawns, candidateWalls, 0)
  if (!path0) return false

  const path1 = findPath(state.pawns, candidateWalls, 1)
  if (!path1) return false

  return true
}

/** Calculate all legal pawn move destinations for a player */
export function getLegalMoves(state, playerIndex = state.turn) {
  if (state.winner !== null) return []

  const me = state.pawns[playerIndex]
  const opp = state.pawns[1 - playerIndex]
  const walls = state.walls
  const moves = []

  const deltas = [
    [-1, 0], // Up
    [1, 0],  // Down
    [0, -1], // Left
    [0, 1],  // Right
  ]

  for (const [dr, dc] of deltas) {
    const nr = me.row + dr
    const nc = me.col + dc

    if (!canPass(walls, me.row, me.col, nr, nc)) continue

    // Empty cell
    if (nr !== opp.row || nc !== opp.col) {
      moves.push({ row: nr, col: nc, type: 'step' })
      continue
    }

    // Opponent is on (nr, nc) -> evaluate Jump!
    const jumpR = nr + dr
    const jumpC = nc + dc

    // Can straight jump if unblocked and within board
    if (canPass(walls, nr, nc, jumpR, jumpC)) {
      moves.push({ row: jumpR, col: jumpC, type: 'jump' })
    } else {
      // Straight jump is blocked by a wall or edge!
      // Diagonal jumps to either side of the opponent become legal
      const sideDeltas = dr !== 0 ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]]
      for (const [sdr, sdc] of sideDeltas) {
        const diagR = nr + sdr
        const diagC = nc + sdc
        if (canPass(walls, nr, nc, diagR, diagC)) {
          moves.push({ row: diagR, col: diagC, type: 'diagonal' })
        }
      }
    }
  }

  return moves
}

/** Execute pawn move */
export function applyMovePawn(state, targetRow, targetCol) {
  if (state.winner !== null) return { ok: false, error: 'Match already finished.' }

  const legalMoves = getLegalMoves(state, state.turn)
  const isLegal = legalMoves.some((m) => m.row === targetRow && m.col === targetCol)

  if (!isLegal) return { ok: false, error: 'Illegal move.' }

  state.pawns[state.turn] = { row: targetRow, col: targetCol }
  state.moveHistory.push({
    player: state.turn,
    type: 'move',
    to: { row: targetRow, col: targetCol },
  })

  // Check Win Condition
  const targetGoalRow = state.turn === 0 ? 0 : 8
  if (targetRow === targetGoalRow) {
    state.winner = state.turn
  } else {
    state.turn = 1 - state.turn
  }

  state.version += 1
  return { ok: true }
}

/** Execute wall placement */
export function applyPlaceWall(state, row, col, orientation) {
  if (!isValidWallPlacement(state, row, col, orientation)) {
    return { ok: false, error: 'Invalid wall placement or blocks all paths.' }
  }

  const player = state.turn
  state.walls.push({ row, col, orientation, placedBy: player })
  state.wallsLeft[player] -= 1

  state.moveHistory.push({
    player,
    type: 'wall',
    wall: { row, col, orientation },
  })

  state.turn = 1 - state.turn
  state.version += 1
  return { ok: true }
}

/**
 * Intelligent AI Bot (A* / Shortest Path Heuristic)
 * Evaluates moving closer to goal vs blocking opponent with a high-impact wall.
 */
export function getBestAIMove(state, difficulty = 'medium') {
  const bot = state.turn
  const opp = 1 - bot

  const legalMoves = getLegalMoves(state, bot)
  if (legalMoves.length === 0) return null

  const myPath = findPath(state.pawns, state.walls, bot)
  const oppPath = findPath(state.pawns, state.walls, opp)

  const myDist = myPath ? myPath.length - 1 : 99
  const oppDist = oppPath ? oppPath.length - 1 : 99

  // Easy mode: pure random / greedy step
  if (difficulty === 'easy') {
    // 80% of the time, pick the move that minimizes distance
    let bestStep = legalMoves[0]
    let bestDist = 999
    for (const m of legalMoves) {
      const targetRow = bot === 0 ? 0 : 8
      const d = Math.abs(m.row - targetRow)
      if (d < bestDist) {
        bestDist = d
        bestStep = m
      }
    }
    return { type: 'move', row: bestStep.row, col: bestStep.col }
  }

  // Medium / Hard mode: Evaluate move vs placing a wall
  let bestAction = null
  let bestScore = -9999

  // 1. Evaluate legal moves
  for (const m of legalMoves) {
    const tempPawns = [
      bot === 0 ? { row: m.row, col: m.col } : state.pawns[0],
      bot === 1 ? { row: m.row, col: m.col } : state.pawns[1],
    ]
    const p = findPath(tempPawns, state.walls, bot)
    const newDist = p ? p.length - 1 : 99
    // Immediate win
    if ((bot === 0 && m.row === 0) || (bot === 1 && m.row === 8)) {
      return { type: 'move', row: m.row, col: m.col }
    }
    const score = (myDist - newDist) * 3 + (oppDist - 1)
    if (score > bestScore) {
      bestScore = score
      bestAction = { type: 'move', row: m.row, col: m.col }
    }
  }

  // 2. Evaluate walls if bot has walls left and opponent is threatening
  if (state.wallsLeft[bot] > 0 && (oppDist <= myDist || difficulty === 'hard')) {
    // Sample high-value wall positions along opponent's shortest path
    const candidateIntersections = []
    if (oppPath && oppPath.length >= 2) {
      for (let i = 0; i < Math.min(3, oppPath.length - 1); i += 1) {
        const step = oppPath[i]
        const next = oppPath[i + 1]
        const minR = Math.min(step.row, next.row)
        const minC = Math.min(step.col, next.col)

        if (step.row === next.row) {
          // Horizontal step -> block with vertical wall
          candidateIntersections.push({ r: minR, c: minC, o: 'V' })
          candidateIntersections.push({ r: Math.max(0, minR - 1), c: minC, o: 'V' })
        } else {
          // Vertical step -> block with horizontal wall
          candidateIntersections.push({ r: minR, c: minC, o: 'H' })
          candidateIntersections.push({ r: minR, c: Math.max(0, minC - 1), o: 'H' })
        }
      }
    }

    for (const cand of candidateIntersections) {
      if (isValidWallPlacement(state, cand.r, cand.c, cand.o)) {
        const tempWalls = [
          ...state.walls,
          { row: cand.r, col: cand.c, orientation: cand.o, placedBy: bot },
        ]
        const newOppP = findPath(state.pawns, tempWalls, opp)
        const newMyP = findPath(state.pawns, tempWalls, bot)

        if (newOppP && newMyP) {
          const newOppDist = newOppP.length - 1
          const newMyDist = newMyP.length - 1
          // Score = increase in opponent distance minus penalty for slowing ourselves
          const wallScore = (newOppDist - oppDist) * 4 - (newMyDist - myDist) * 2

          if (wallScore > bestScore && newOppDist > oppDist) {
            bestScore = wallScore
            bestAction = {
              type: 'wall',
              row: cand.r,
              col: cand.c,
              orientation: cand.o,
            }
          }
        }
      }
    }
  }

  return bestAction || { type: 'move', row: legalMoves[0].row, col: legalMoves[0].col }
}
