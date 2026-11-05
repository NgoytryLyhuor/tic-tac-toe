<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import HomeScreen from './components/HomeScreen.vue'
import LobbyScreen from './components/LobbyScreen.vue'
import GameScreen from './components/GameScreen.vue'
import { GameSession } from './lib/gameSession.js'
import { normalizeCode } from './lib/gameLogic.js'
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
const connection = ref('idle')
const brokerIndex = ref(-1)

let session = null
let busyTimer = null

const screen = computed(() => {
  if (!room.value) return 'home'
  return room.value.status === 'waiting' ? 'lobby' : 'game'
})

const inviteUrl = computed(() => {
  if (!room.value) return ''
  const params = new URLSearchParams({ code: room.value.code })
  if (brokerIndex.value >= 0) params.set('b', String(brokerIndex.value))
  return `${location.origin}${location.pathname}?${params.toString()}`
})

function syncUrl(nextCode) {
  try {
    const url = new URL(location.href)
    if (nextCode) url.searchParams.set('code', nextCode)
    else url.searchParams.delete('code')
    url.searchParams.delete('b')
    history.replaceState({}, '', url)
  } catch {
    /* ignore */
  }
}

function clearBusyTimer() {
  if (busyTimer) {
    clearTimeout(busyTimer)
    busyTimer = null
  }
}

function openSession() {
  session?.stop()

  session = new GameSession({
    playerId,
    onState: (next) => {
      room.value = next
      loading.value = false
      busy.value = false
      clearBusyTimer()

      if (next) {
        error.value = ''
        if (next.code) {
          code.value = next.code
          saveSession(next.code)
          syncUrl(next.code)
        }
      }
    },
    onStatus: (status) => {
      connection.value = status
      if (status === 'connecting' || status === 'probing') {
        loading.value = !room.value
      } else if (status === 'reconnecting') {
        loading.value = !room.value
      } else {
        loading.value = false
      }
    },
    onError: (message) => {
      error.value = message
    },
    onBroker: (index) => {
      brokerIndex.value = index
    },
  })

  return session
}

function startJoin(nextCode, preferredBroker = -1) {
  const normalized = normalizeCode(nextCode)

  if (normalized.length < 3) {
    error.value = 'Please enter a match code with at least 3 characters.'
    return
  }

  error.value = ''
  loading.value = true
  code.value = normalized
  saveName(name.value.trim())
  saveSession(normalized)
  syncUrl(normalized)

  const active = openSession()
  active.join(normalized, name.value.trim(), preferredBroker)
}

function joinMatch() {
  startJoin(code.value)
}

function playMove(cell) {
  if (!session || busy.value) return

  busy.value = true
  const result = session.move(cell)

  if (!result.ok) {
    error.value = result.error
    busy.value = false
    return
  }

  clearBusyTimer()
  busyTimer = setTimeout(() => {
    busy.value = false
  }, 1200)
}

function requestRematch() {
  if (!session || busy.value) return

  busy.value = true
  const result = session.rematch()

  if (!result.ok) {
    error.value = result.error
    busy.value = false
    return
  }

  clearBusyTimer()
  busyTimer = setTimeout(() => {
    busy.value = false
  }, 1200)
}

function leaveMatch() {
  session?.leave()
  session = null
  room.value = null
  error.value = ''
  loading.value = false
  busy.value = false
  connection.value = 'idle'
  brokerIndex.value = -1
  clearBusyTimer()
  clearSession()
  syncUrl('')
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

function onPageHide() {
  session?.pageHide()
}

onMounted(() => {
  window.addEventListener('pagehide', onPageHide)

  const params = new URLSearchParams(location.search)
  const urlCode = normalizeCode(params.get('code'))
  const preferredBroker = params.has('b') ? Number(params.get('b')) : -1
  const saved = loadSession()

  if (urlCode) {
    code.value = urlCode
    if (saved && saved !== urlCode) clearSession()

    if (loadName() || telegram.user?.first_name) {
      startJoin(urlCode, Number.isFinite(preferredBroker) ? preferredBroker : -1)
    }
    return
  }

  if (saved && (loadName() || telegram.user?.first_name)) {
    startJoin(saved)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('pagehide', onPageHide)
  session?.stop()
  clearBusyTimer()
})
</script>

<template>
  <div class="app">
    <main class="shell">
      <div v-if="loading" class="card loading-card">
        <span class="spinner big" aria-hidden="true"></span>
        <p>Looking for the match…</p>
      </div>

      <HomeScreen
        v-else-if="screen === 'home'"
        v-model:code="code"
        v-model:name="name"
        :busy="busy"
        :error="error"
        @submit="joinMatch"
      />

      <LobbyScreen
        v-else-if="screen === 'lobby'"
        :room="room"
        :invite-url="inviteUrl"
        :copied="copied"
        :busy="busy"
        :connection="connection"
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
        :connection="connection"
        @move="playMove"
        @rematch="requestRematch"
        @leave="leaveMatch"
        @copy-link="copyLink"
      />

      <p v-if="room && error" class="alert floating" role="alert">{{ error }}</p>
    </main>

    <footer class="footer">
      <span>No account, no database</span>
      <span class="dot">•</span>
      <span>Just share the code and play</span>
    </footer>
  </div>
</template>
