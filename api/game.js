import { deleteRoom, getRoom, saveRoom, usingRedis } from './_store.js'
import {
  createRoom,
  decideResult,
  normalizeCode,
  normalizeName,
  publicRoom,
  symbolFor,
} from './_logic.js'

function send(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.end(JSON.stringify(payload))
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body
  }

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}

  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/**
 * Single endpoint used by both the Vercel function and the local Vite dev server.
 *
 *   GET  /api/game?action=health
 *   GET  /api/game?action=state&code=1234&playerId=...
 *   POST /api/game?action=join     { code, playerId, name }
 *   POST /api/game?action=move     { code, playerId, cell }
 *   POST /api/game?action=rematch  { code, playerId }
 *   POST /api/game?action=leave    { code, playerId }
 */
export default async function handler(req, res) {
  try {
    const url = new URL(req.url || '/', 'http://localhost')
    const action = (url.searchParams.get('action') || 'state').toLowerCase()
    const body = req.method === 'POST' || req.method === 'PUT' ? await readBody(req) : {}
    const params = { ...Object.fromEntries(url.searchParams.entries()), ...body }

    if (action === 'health') {
      return send(res, 200, { ok: true, storage: usingRedis ? 'redis' : 'memory' })
    }

    const code = normalizeCode(params.code)
    const playerId = String(params.playerId ?? '').trim()

    if (code.length < 3) {
      return send(res, 400, { error: 'Enter a match code with at least 3 letters or numbers.' })
    }
    if (!playerId || playerId.length > 100) {
      return send(res, 400, { error: 'Missing player id. Try reloading the page.' })
    }

    if (action === 'state') {
      const room = await getRoom(code)
      if (!room) {
        return send(res, 404, { error: 'Match not found. Check the code or create a new match.' })
      }
      if (!symbolFor(room, playerId)) {
        return send(res, 403, { error: 'You are not part of this match.' })
      }
      return send(res, 200, { room: publicRoom(room, playerId), you: symbolFor(room, playerId) })
    }

    if (action === 'join') {
      let room = await getRoom(code)

      if (!room) {
        room = createRoom(code)
        room.players.X = { id: playerId, name: normalizeName(params.name, 'Player 1') }
        room.status = 'waiting'
        room.version = 1
      } else {
        const existing = symbolFor(room, playerId)

        if (existing) {
          // Re-joining the same match (e.g. after a refresh).
          if (params.name) {
            room.players[existing].name = normalizeName(params.name, room.players[existing].name)
          }
        } else {
          const openSlot = room.players.X ? (room.players.O ? null : 'O') : 'X'

          if (!openSlot) {
            return send(res, 409, {
              error: 'This match is already full. Ask your friend for a new code.',
            })
          }

          room.players[openSlot] = {
            id: playerId,
            name: normalizeName(params.name, openSlot === 'X' ? 'Player 1' : 'Player 2'),
          }
          room.board = Array(9).fill(null)
          room.result = null
          room.rematch = { X: false, O: false }
          room.status = 'playing'
          room.turn = 'X'
          room.version = (room.version || 0) + 1
        }
      }

      await saveRoom(room)
      return send(res, 200, { room: publicRoom(room, playerId), you: symbolFor(room, playerId) })
    }

    if (action === 'move') {
      const room = await getRoom(code)
      if (!room) return send(res, 404, { error: 'Match not found.' })

      const you = symbolFor(room, playerId)
      if (!you) return send(res, 403, { error: 'You are not part of this match.' })
      if (room.status === 'waiting') {
        return send(res, 409, { error: 'Waiting for an opponent to join.' })
      }
      if (room.status !== 'playing') {
        return send(res, 409, { error: 'This round is over. Start a rematch to play again.' })
      }
      if (room.turn !== you) {
        return send(res, 409, { error: "It's not your turn yet." })
      }

      const cell = Number(params.cell)
      if (!Number.isInteger(cell) || cell < 0 || cell > 8) {
        return send(res, 400, { error: 'Invalid square.' })
      }
      if (room.board[cell] !== null) {
        return send(res, 409, { error: 'That square is already taken.' })
      }

      room.board[cell] = you
      const result = decideResult(room.board)

      if (result) {
        room.status = 'finished'
        room.result = result
        room.rematch = { X: false, O: false }
      } else {
        room.turn = you === 'X' ? 'O' : 'X'
      }

      room.version = (room.version || 0) + 1
      await saveRoom(room)
      return send(res, 200, { room: publicRoom(room, playerId), you })
    }

    if (action === 'rematch') {
      const room = await getRoom(code)
      if (!room) return send(res, 404, { error: 'Match not found.' })

      const you = symbolFor(room, playerId)
      if (!you) return send(res, 403, { error: 'You are not part of this match.' })
      if (room.status !== 'finished') {
        return send(res, 409, { error: 'Finish the current round first.' })
      }
      if (!room.players.X || !room.players.O) {
        return send(res, 409, { error: 'Waiting for an opponent to join.' })
      }

      room.rematch[you] = true

      if (room.rematch.X && room.rematch.O) {
        room.board = Array(9).fill(null)
        room.turn = 'X'
        room.status = 'playing'
        room.result = null
        room.rematch = { X: false, O: false }
      }

      room.version = (room.version || 0) + 1
      await saveRoom(room)
      return send(res, 200, { room: publicRoom(room, playerId), you })
    }

    if (action === 'leave') {
      const room = await getRoom(code)
      if (!room) return send(res, 200, { ok: true })

      const you = symbolFor(room, playerId)
      if (you) room.players[you] = null

      if (!room.players.X && !room.players.O) {
        await deleteRoom(code)
        return send(res, 200, { ok: true })
      }

      room.board = Array(9).fill(null)
      room.result = null
      room.rematch = { X: false, O: false }
      room.status = 'waiting'
      room.turn = 'X'
      room.version = (room.version || 0) + 1
      await saveRoom(room)
      return send(res, 200, { ok: true })
    }

    return send(res, 404, { error: `Unknown action: ${action}` })
  } catch (error) {
    console.error('[api/game]', error)
    return send(res, 500, { error: 'Server error. Please try again.' })
  }
}
