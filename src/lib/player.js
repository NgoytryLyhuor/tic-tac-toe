const PLAYER_KEY = 'ttt.playerId'
const NAME_KEY = 'ttt.playerName'
const SESSION_KEY = 'ttt.sessionCode'
const HOST_PREFIX = 'ttt.host.'

function storageGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

export function getPlayerId() {
  const existing = storageGet(PLAYER_KEY)
  if (existing) return existing

  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `p-${Date.now()}-${Math.random().toString(16).slice(2)}`

  storageSet(PLAYER_KEY, id)
  return id
}

export const loadName = () => storageGet(NAME_KEY) || ''
export const saveName = (name) => storageSet(NAME_KEY, name)
export const loadSession = () => storageGet(SESSION_KEY) || ''
export const saveSession = (code) => storageSet(SESSION_KEY, code)
export const clearSession = () => storageRemove(SESSION_KEY)

export function saveHostSession(code, data) {
  try {
    if (!code) return
    sessionStorage.setItem(`${HOST_PREFIX}${code}`, JSON.stringify(data))
  } catch {
    /* storage unavailable */
  }
}

export function loadHostSession(code) {
  try {
    if (!code) return null
    const raw = sessionStorage.getItem(`${HOST_PREFIX}${code}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearHostSession(code) {
  try {
    if (!code) return
    sessionStorage.removeItem(`${HOST_PREFIX}${code}`)
  } catch {
    /* storage unavailable */
  }
}
