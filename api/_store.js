/**
 * Room storage.
 *
 * - In production on Vercel, use Upstash Redis (or Vercel KV) through its REST API
 *   so both players see the same room no matter which serverless instance they hit.
 * - Locally (and as a best-effort fallback), rooms are kept in memory.
 *
 * Supported env vars:
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 *   KV_REST_API_URL        / KV_REST_API_TOKEN
 */

const redisUrl = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/+$/, '')
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''

export const usingRedis = Boolean(redisUrl && redisToken)

const ROOM_TTL_SECONDS = 60 * 60 * 24 // rooms expire after 24h of inactivity
const memoryRooms = globalThis.__tttRooms || (globalThis.__tttRooms = new Map())

const keyFor = (code) => `ttt:room:${code}`

async function redisCommand(args) {
  const res = await fetch(redisUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) {
    throw new Error(`Redis request failed (${res.status}): ${await res.text()}`)
  }

  const data = await res.json()
  if (data && data.error) throw new Error(`Redis error: ${data.error}`)
  return data ? data.result : null
}

const clone = (value) => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)))

export async function getRoom(code) {
  if (usingRedis) {
    const raw = await redisCommand(['GET', keyFor(code)])
    return raw ? JSON.parse(raw) : null
  }

  const entry = memoryRooms.get(code)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    memoryRooms.delete(code)
    return null
  }
  return clone(entry.room)
}

export async function saveRoom(room) {
  room.updatedAt = Date.now()

  if (usingRedis) {
    await redisCommand(['SET', keyFor(room.code), JSON.stringify(room), 'EX', ROOM_TTL_SECONDS])
    return
  }

  memoryRooms.set(room.code, {
    room: clone(room),
    expiresAt: Date.now() + ROOM_TTL_SECONDS * 1000,
  })
}

export async function deleteRoom(code) {
  if (usingRedis) {
    await redisCommand(['DEL', keyFor(code)])
    return
  }
  memoryRooms.delete(code)
}
