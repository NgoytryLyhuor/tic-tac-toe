<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
import {
  isSoundEnabled,
  playClickSound,
  playDrawSound,
  playJoinSound,
  playMoveSound,
  playWinSound,
  setSoundEnabled,
  toggleSound as libToggleSound,
} from './lib/sound.js'

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
const soundOn = ref(isSoundEnabled())

let session = null
let busyTimer = null
let lastStatus = null
let lastResultHandled = null

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

function toggleSound() {
  soundOn.value = libToggleSound()
}

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

function generateRandomCode() {
  playClickSound()
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let res = ''
  for (let i = 0; i < 5; i += 1) {
    res += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  code.value = res
}

function openSession() {
  session?.stop()

  session = new GameSession({
    playerId,
    onState: (next) => {
      const prev = room.value
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

        // Opponent just joined the lobby
        if (prev?.status === 'waiting' && next.status === 'playing') {
          playJoinSound()
          telegram.haptic('success')
        }

        // Round finished sound / haptic handling
        if (next.status === 'finished' && next.result && lastResultHandled !== next.version) {
          lastResultHandled = next.version
          if (next.result.winner === next.you) {
            playWinSound()
            telegram.haptic('success')
          } else if (next.result.winner === 'draw') {
            playDrawSound()
            telegram.haptic('warning')
          } else {
            playDrawSound()
            telegram.haptic('error')
          }
        }
      }
    },
    onStatus: (status) => {
      connection.value = status
      if (status === 'connecting' || status === 'probing' || status === 'reconnecting') {
        loading.value = !room.value
      } else {
        loading.value = false
      }
    },
    onError: (message) => {
      error.value = message
      busy.value = false
      loading.value = false
      telegram.haptic('error')
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
    telegram.haptic('warning')
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
  playClickSound()
  startJoin(code.value)
}

function playMove(cell) {
  if (!session || !room.value) return
  if (room.value.status !== 'playing' || room.value.turn !== room.value.you) return

  telegram.haptic('light')
  playMoveSound(room.value.you)

  const result = session.move(cell)
  if (!result.ok) {
    error.value = result.error
    telegram.haptic('warning')
  }
}

function requestRematch() {
  if (!session || !room.value) return
  playClickSound()
  telegram.haptic('light')

  const result = session.rematch()
  if (!result.ok) {
    error.value = result.error
    telegram.haptic('warning')
  }
}

function leaveMatch() {
  playClickSound()
  telegram.haptic('light')
  session?.leave()
  session = null
  room.value = null
  error.value = ''
  loading.value = false
  busy.value = false
  connection.value = 'idle'
  brokerIndex.value = -1
  lastResultHandled = null
  clearBusyTimer()
  clearSession()
  syncUrl('')
}

async function shareInvite() {
  playClickSound()
  telegram.haptic('light')
  const url = inviteUrl.value
  const matchCode = room.value?.code || ''
  const shareData = {
    title: 'Tic Tac Toe match',
    text: `Join my Tic Tac Toe match! Code: ${matchCode}`,
    url: url,
  }

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData)
      return
    } catch {
      /* user dismissed or denied share sheet */
    }
  }

  // Fallback to clipboard copy
  copyLink()
}

async function copyText(text, label) {
  if (!text) return
  playClickSound()
  telegram.haptic('light')

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
  }, 2000)
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
    <!-- Top global bar for audio & status -->
    <header class="top-nav">
      <div class="brand-mini">
        <span class="mini-x">✕</span>
        <span class="mini-o">○</span>
        <span class="brand-title">Tic Tac Toe</span>
      </div>

      <div class="top-actions">
        <button
          class="icon-btn"
          type="button"
          :title="soundOn ? 'Mute sound' : 'Unmute sound'"
          :aria-label="soundOn ? 'Mute sound' : 'Unmute sound'"
          @click="toggleSound"
        >
          <span v-if="soundOn" class="icon">🔊</span>
          <span v-else class="icon">🔇</span>
        </button>

        <span
          v-if="connection !== 'idle' && connection !== 'closed'"
          class="conn-pill"
          :class="connection"
          :title="`Status: ${connection}`"
        >
          <span class="conn-dot"></span>
          <span class="conn-label">{{ connection }}</span>
        </span>
      </div>
    </header>

    <main class="shell">
      <div v-if="loading" class="card loading-card">
        <span class="spinner big" aria-hidden="true"></span>
        <p class="loading-title">Connecting to match…</p>
        <span class="loading-sub">Linking up over secure peer-to-peer relay</span>
      </div>

      <HomeScreen
        v-else-if="screen === 'home'"
        v-model:code="code"
        v-model:name="name"
        :busy="busy"
        :error="error"
        @random-code="generateRandomCode"
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
        @share="shareInvite"
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
        @share="shareInvite"
      />

      <p v-if="room && error" class="alert floating" role="alert">{{ error }}</p>
    </main>

    <footer class="footer">
      <span>Zero accounts or DB</span>
      <span class="dot">•</span>
      <span>Fair alternating rounds</span>
      <span class="dot">•</span>
      <span>Share code & play</span>
    </footer>
  </div>
</template>
