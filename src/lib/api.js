const BASE = '/api/game'

async function request(params, { method = 'GET', body } = {}) {
  const url = `${BASE}?${new URLSearchParams(params).toString()}`

  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  let data = {}
  try {
    data = await res.json()
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status}).`)
    error.status = res.status
    throw error
  }

  return data
}

export const api = {
  health: () => request({ action: 'health' }),
  state: (code, playerId) => request({ action: 'state', code, playerId }),
  join: (code, playerId, name) =>
    request({ action: 'join' }, { method: 'POST', body: { code, playerId, name } }),
  move: (code, playerId, cell) =>
    request({ action: 'move' }, { method: 'POST', body: { code, playerId, cell } }),
  rematch: (code, playerId) =>
    request({ action: 'rematch' }, { method: 'POST', body: { code, playerId } }),
  leave: (code, playerId) =>
    request({ action: 'leave' }, { method: 'POST', body: { code, playerId } }),
}
