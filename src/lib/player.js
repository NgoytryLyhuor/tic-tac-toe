const PLAYER_KEY = 'ttt.playerId'
const NAME_KEY = 'ttt.playerName'
const SESSION_KEY = 'ttt.sessionCode'

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
