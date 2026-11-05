<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import HomeScreen from './components/HomeScreen.vue'
import LobbyScreen from './components/LobbyScreen.vue'
import GameScreen from './components/GameScreen.vue'
import { api } from './lib/api.js'
import {
  clearSession,
  getPlayerId,
  loadName,
  loadSession,
  saveName,
  saveSession,
} from './lib/player.js'
import { initTelegram } from './lib/telegram.js'

const telegram = initTelegram()
const playerId = getPlayerId()

const room = ref(null)
const code = ref('')
const name = ref(loadName() || telegram.user?.first_name || '')
const error = ref('')
const busy = ref(false)
const loading = ref(false)
const copied = ref('')
const storage = ref('')

const POLL_INTERVAL = 1500
let pollTimer = null
let polling = false

const screen = computed(() => {
  if (!room.value) return 'home'
  return room.value.status === 'waiting' ? 'lobby' : 'game'
})

const inviteUrl = computed(() => {
  if (!room.value) return ''
  return `${location.origin}${location.pathname}?code=${encodeURIComponent(room.value.code)}`
})

const isDeployed = typeof location !== 'undefined' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)

const storageWarning = computed(() => {
  if (storage.value === 'memory' && isDeployed) {
    return 'This deployment has no shared room database, so two different devices may not see the same match. Add Upstash Redis environment variables in Vercel — see the README.'
  }
  return ''
})

function normalizeCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
}

function syncUrl(nextCode) {
  try {
    const url = new URL(location.href)
    if (nextCode) url.searchParams.set('code', nextCode)
    else url.searchParams.delete('code')
    history.replaceState({}, '', url)
  } catch {
    /* ignore */
  }
}

function applyRoom(next) {
  if (!next) return
  room.value = next
  if (next.code) code.value = next.code
  syncUrl(next.code)
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(poll, POLL_INTERVAL)
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

async function poll() {
  const current = room.value
  if (!current || polling) return

  // Nothing can change while it is your turn, so skip those requests.
  const shouldPoll =
    current.status === 'waiting' ||
    current.status === 'finished' ||
    (current.status === 'playing' && current.turn !== current.you)

  if (!shouldPoll) return

  polling = true
  try {
    const data = await api.state(current.code, playerId)
    if (room.value && room.value.code === current.code) applyRoom(data.room)
  } catch (err) {
    if (err.status === 404) {
      stopPolling()
      room.value = null
      clearSession()
      syncUrl('')
      error.value = 'This match has ended. Create or join a new one.'
    }
  } finally {
    polling = false
  }
}

async function resume(candidateCode) {
  loading.value = true
  try {
    const data = await api.state(candidateCode, playerId)
    applyRoom(data.room)
    startPolling()
  } catch (err) {
    if (err.status === 404 || err.status === 403) {
      clearSession()
      syncUrl('')
    }
  } finally {
    loading.value = false
  }
}

async function joinMatch() {
  error.value = ''
  const nextCode = normalizeCode(code.value)

  if (nextCode.length < 3) {
    error.value = 'Please enter a match code with at least 3 characters.'
    return
  }

  busy.value = true
  try {
    const data = await api.join(nextCode, playerId, name.value.trim())
    saveName(name.value.trim())
    saveSession(nextCode)
    applyRoom(data.room)
    startPolling()
    telegram.haptic('light')
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function playMove(cell) {
  if (!room.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const data = await api.move(room.value.code, playerId, cell)
    applyRoom(data.room)
    telegram.haptic('light')
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function requestRematch() {
  if (!room.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const data = await api.rematch(room.value.code, playerId)
    applyRoom(data.room)
    telegram.haptic('light')
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function leaveMatch() {
  const current = room.value
  stopPolling()
  room.value = null
  error.value = ''
  clearSession()
  syncUrl('')
  if (current) {
    try {
      await api.leave(current.code, playerId)
    } catch {
      /* room may already be gone */
    }
  }
}

async function copyText(text, label) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    try {
      document.execCommand('copy')
    } catch {
      /* ignore */
    }
    document.body.removeChild(area)
  }
  copied.value = label
  setTimeout(() => {
    if (copied.value === label) copied.value = ''
  }, 1800)
}

const copyCode = () => copyText(room.value?.code, 'code')
const copyLink = () => copyText(inviteUrl.value, 'link')

function onVisibilityChange() {
  if (document.hidden) {
    stopPolling()
  } else if (room.value) {
    startPolling()
    poll()
  }
}

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityChange)

  try {
    const health = await api.health()
    storage.value = health.storage
  } catch {
    /* health is only informational */
  }

  const urlCode = normalizeCode(new URLSearchParams(location.search).get('code'))
  const saved = loadSession()

  if (urlCode) {
    code.value = urlCode
    if (saved && saved !== urlCode) clearSession()
    if (saved === urlCode || saved === '') {
      // Returning player: silently rejoin if the room still knows us.
      if (loadName() || telegram.user?.first_name) await resume(urlCode)
    }
    return
  }

  if (saved) await resume(saved)
})

onBeforeUnmount(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div class="app">
    <main class="shell">
      <div v-if="loading" class="card loading-card">
        <span class="spinner big" aria-hidden="true"></span>
        <p>Rejoining your match…</p>
      </div>

      <HomeScreen
        v-else-if="screen === 'home'"
        v-model:code="code"
        v-model:name="name"
        :busy="busy"
        :error="error"
        :warning="storageWarning"
        @submit="joinMatch"
      />

      <LobbyScreen
        v-else-if="screen === 'lobby'"
        :room="room"
        :invite-url="inviteUrl"
        :copied="copied"
        :busy="busy"
        @copy-code="copyCode"
        @copy-link="copyLink"
        @leave="leaveMatch"
      />

      <GameScreen
        v-else
        :room="room"
        :invite-url="inviteUrl"
        :copied="copied"
        :busy="busy"
        @move="playMove"
        @rematch="requestRematch"
        @leave="leaveMatch"
        @copy-link="copyLink"
      />

      <p v-if="room && error" class="alert floating" role="alert">{{ error }}</p>
    </main>

    <footer class="footer">
      <span>Built for playing with friends</span>
      <span class="dot">•</span>
      <span>Works in any browser or as a Telegram Mini App</span>
    </footer>
  </div>
</template>
