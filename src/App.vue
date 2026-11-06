<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import GameHub from './components/GameHub.vue'
import BarricadeGame from './components/BarricadeGame.vue'
import HomeScreen from './components/HomeScreen.vue'
import LobbyScreen from './components/LobbyScreen.vue'
import GameScreen from './components/GameScreen.vue'
import { GameSession } from './lib/gameSession.js'
import { decideResult, normalizeCode } from './lib/gameLogic.js'
import { getTicTacToeAIMove } from './lib/ticTacToeAI.js'
import {
  clearSession,
  getPlayerId,
  loadName,
  loadSession,
  saveName,
  saveSession,
} from './lib/player.js'
import { currentLang, toggleLanguage, t } from './lib/i18n.js'
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

// Active game view: 'hub' | 'barricade' | 'ttt'
const currentGame = ref('hub')

// Tic Tac Toe Mode: 'online' | 'ai' | 'pass'
const tttMode = ref('online')
const aiDifficulty = ref('medium')

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
const barricadeCode = ref('')
const barricadeBroker = ref(-1)

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
  const params = new URLSearchParams({ game: 'ttt', code: room.value.code })
  if (brokerIndex.value >= 0) params.set('b', String(brokerIndex.value))
  return `${location.origin}${location.pathname}?${params.toString()}`
})

function toggleSound() {
  soundOn.value = libToggleSound()
}

function onToggleLang() {
  playClickSound()
  telegram.haptic('light')
  toggleLanguage()
}

function syncUrl(nextCode) {
  try {
    const url = new URL(location.href)
    if (nextCode) {
      url.searchParams.set('game', 'ttt')
      url.searchParams.set('code', nextCode)
    } else {
      url.searchParams.delete('code')
    }
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

  tttMode.value = 'online'
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

// Start Solo AI Match
function startSoloAIMatch(diff = 'medium') {
  playClickSound()
  telegram.haptic('light')
  tttMode.value = 'ai'
  aiDifficulty.value = diff
  session?.leave()
  session = null

  const pName = name.value.trim() || 'You'
  const diffLabel = diff === 'master' ? 'Master' : diff.charAt(0).toUpperCase() + diff.slice(1)
  const botName = `AI (${diffLabel})`

  room.value = {
    code: `AI-${diff.toUpperCase()}`,
    mode: 'ai',
    status: 'playing',
    turn: 'X',
    starter: 'X',
    round: 1,
    you: 'X',
    opponentOnline: true,
    players: {
      X: { name: pName },
      O: { name: botName },
    },
    scores: { X: 0, O: 0, draws: 0 },
    board: Array(9).fill(null),
    result: null,
    rematch: { X: false, O: false },
    version: 1,
  }
}

// Start Local Pass & Play Match
function startPassAndPlayMatch() {
  playClickSound()
  telegram.haptic('light')
  tttMode.value = 'pass'
  session?.leave()
  session = null

  const p1Name = name.value.trim() || 'Player 1'

  room.value = {
    code: 'LOCAL-2P',
    mode: 'pass',
    status: 'playing',
    turn: 'X',
    starter: 'X',
    round: 1,
    you: 'X',
    opponentOnline: true,
    players: {
      X: { name: p1Name },
      O: { name: 'Player 2' },
    },
    scores: { X: 0, O: 0, draws: 0 },
    board: Array(9).fill(null),
    result: null,
    rematch: { X: false, O: false },
    version: 1,
  }
}

// Trigger AI Move after short thinking delay
function triggerAiMove() {
  if (tttMode.value !== 'ai' || !room.value || room.value.status !== 'playing') return
  if (room.value.turn !== 'O') return

  busy.value = true
  setTimeout(() => {
    if (!room.value || room.value.status !== 'playing' || room.value.turn !== 'O') {
      busy.value = false
      return
    }

    const botCell = getTicTacToeAIMove(room.value.board, aiDifficulty.value, 'O')
    if (botCell === null || botCell === undefined) {
      busy.value = false
      return
    }

    const newBoard = [...room.value.board]
    newBoard[botCell] = 'O'
    room.value.board = newBoard
    playMoveSound('O')
    telegram.haptic('light')

    const outcome = decideResult(newBoard)
    if (outcome) {
      handleLocalGameEnd(outcome)
    } else {
      room.value.turn = 'X'
    }
    busy.value = false
  }, 380)
}

function handleLocalGameEnd(outcome) {
  room.value.result = outcome
  room.value.status = 'finished'
  room.value.version = (room.value.version || 1) + 1

  if (outcome.winner === 'X') {
    room.value.scores.X += 1
  } else if (outcome.winner === 'O') {
    room.value.scores.O += 1
  } else if (outcome.winner === 'draw') {
    room.value.scores.draws += 1
  }

  if (tttMode.value === 'ai') {
    if (outcome.winner === room.value.you) {
      playWinSound()
      telegram.haptic('success')
    } else if (outcome.winner === 'draw') {
      playDrawSound()
      telegram.haptic('warning')
    } else {
      playDrawSound()
      telegram.haptic('error')
    }
  } else {
    if (outcome.winner === 'draw') {
      playDrawSound()
      telegram.haptic('warning')
    } else {
      playWinSound()
      telegram.haptic('success')
    }
  }
}

function playMove(cell) {
  if (tttMode.value === 'online') {
    if (!session || !room.value) return
    if (room.value.status !== 'playing' || room.value.turn !== room.value.you) return

    telegram.haptic('light')
    playMoveSound(room.value.you)

    const result = session.move(cell)
    if (!result.ok) {
      error.value = result.error
      telegram.haptic('warning')
    }
    return
  }

  // Local modes: 'ai' or 'pass'
  if (!room.value || room.value.status !== 'playing') return
  if (room.value.board[cell] !== null) return

  if (tttMode.value === 'ai') {
    if (room.value.turn !== room.value.you || busy.value) return

    telegram.haptic('light')
    playMoveSound(room.value.you)

    const newBoard = [...room.value.board]
    newBoard[cell] = room.value.you
    room.value.board = newBoard

    const outcome = decideResult(newBoard)
    if (outcome) {
      handleLocalGameEnd(outcome)
    } else {
      room.value.turn = 'O'
      triggerAiMove()
    }
  } else if (tttMode.value === 'pass') {
    const currentSymbol = room.value.turn
    telegram.haptic('light')
    playMoveSound(currentSymbol)

    const newBoard = [...room.value.board]
    newBoard[cell] = currentSymbol
    room.value.board = newBoard

    const outcome = decideResult(newBoard)
    if (outcome) {
      handleLocalGameEnd(outcome)
    } else {
      room.value.turn = currentSymbol === 'X' ? 'O' : 'X'
    }
  }
}

function requestRematch() {
  playClickSound()
  telegram.haptic('light')

  if (tttMode.value === 'online') {
    if (!session || !room.value) return
    const result = session.rematch()
    if (!result.ok) {
      error.value = result.error
      telegram.haptic('warning')
    }
    return
  }

  if (!room.value) return
  // Fair alternating turns!
  const nextStarter = room.value.starter === 'X' ? 'O' : 'X'
  room.value.board = Array(9).fill(null)
  room.value.round = (room.value.round || 1) + 1
  room.value.starter = nextStarter
  room.value.turn = nextStarter
  room.value.result = null
  room.value.status = 'playing'
  room.value.rematch = { X: false, O: false }
  room.value.version = (room.value.version || 1) + 1

  if (tttMode.value === 'ai' && nextStarter === 'O') {
    triggerAiMove()
  }
}

function leaveMatch() {
  playClickSound()
  telegram.haptic('light')
  session?.leave()
  session = null
  room.value = null
  tttMode.value = 'online'
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

function onSelectGame(gameKey) {
  playClickSound()
  currentGame.value = gameKey
  try {
    const url = new URL(location.href)
    url.searchParams.set('game', gameKey)
    history.replaceState({}, '', url)
  } catch {}
}

function goToHub() {
  playClickSound()
  if (session) {
    session.leave()
    session = null
    room.value = null
  }
  barricadeCode.value = ''
  barricadeBroker.value = -1
  currentGame.value = 'hub'
  try {
    const url = new URL(location.href)
    url.searchParams.delete('game')
    url.searchParams.delete('code')
    url.searchParams.delete('b')
    history.replaceState({}, '', url)
  } catch {}
}

onMounted(() => {
  window.addEventListener('pagehide', onPageHide)

  const params = new URLSearchParams(location.search)
  const urlGame = params.get('game')
  const urlCode = normalizeCode(params.get('code'))
  const preferredBroker = params.has('b') ? Number(params.get('b')) : -1
  const saved = loadSession()

  if (urlGame === 'barricade') {
    currentGame.value = 'barricade'
    if (urlCode) barricadeCode.value = urlCode
    if (Number.isFinite(preferredBroker)) barricadeBroker.value = preferredBroker
    return
  }

  if (urlCode) {
    currentGame.value = 'ttt'
    code.value = urlCode
    if (saved && saved !== urlCode) clearSession()

    if (loadName() || telegram.user?.first_name) {
      startJoin(urlCode, Number.isFinite(preferredBroker) ? preferredBroker : -1)
    }
    return
  }

  if (urlGame === 'ttt') {
    currentGame.value = 'ttt'
    if (saved && (loadName() || telegram.user?.first_name)) {
      startJoin(saved)
    }
    return
  }

  // Default to Hub showing both games!
  currentGame.value = 'hub'
})

onBeforeUnmount(() => {
  window.removeEventListener('pagehide', onPageHide)
  session?.stop()
  clearBusyTimer()
})
</script>

<template>
  <div class="app">
    <!-- Top global bar for audio & navigation -->
    <header class="top-nav">
      <button
        v-if="currentGame !== 'hub'"
        class="hub-back-btn"
        type="button"
        title="Back to Games Hub"
        @click="goToHub"
      >
        ‹ {{ t('nav_games') }}
      </button>

      <div class="brand-mini">
        <template v-if="currentGame === 'barricade'">
          <span class="hub-icon-badge barricade-icon mini-icon">🧱</span>
          <span class="brand-title">{{ t('nav_barricade') }}</span>
        </template>
        <template v-else-if="currentGame === 'ttt'">
          <span class="mini-x">✕</span>
          <span class="mini-o">○</span>
          <span class="brand-title">{{ t('nav_ttt') }}</span>
        </template>
        <template v-else>
          <span class="brand-title">Mini Games</span>
        </template>
      </div>

      <div class="top-actions">
        <!-- Language Switcher (EN / ខ្មែរ) -->
        <button
          type="button"
          class="lang-btn"
          :title="currentLang === 'en' ? 'ប្តូរទៅភាសាខ្មែរ' : 'Switch to English'"
          @click="onToggleLang"
        >
          <span class="lang-flag">{{ currentLang === 'en' ? '🇰🇭' : '🇬🇧' }}</span>
          <span class="lang-text">{{ currentLang === 'en' ? 'ខ្មែរ' : 'EN' }}</span>
        </button>

        <button
          class="icon-btn"
          type="button"
          :title="soundOn ? t('nav_sound_on') : t('nav_sound_off')"
          :aria-label="soundOn ? t('nav_sound_on') : t('nav_sound_off')"
          @click="toggleSound"
        >
          <span v-if="soundOn" class="icon">🔊</span>
          <span v-else class="icon">🔇</span>
        </button>

        <span
          v-if="currentGame === 'ttt' && tttMode === 'online' && connection !== 'idle' && connection !== 'closed'"
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
      <!-- Game Hub Screen: Choose between the 2 games -->
      <GameHub
        v-if="currentGame === 'hub'"
        @select-game="onSelectGame"
      />

      <!-- New Game: Barricade (Quoridor 9x9) -->
      <BarricadeGame
        v-else-if="currentGame === 'barricade'"
        :initial-code="barricadeCode"
        :initial-broker="barricadeBroker"
        @back-to-hub="goToHub"
      />

      <!-- Classic Game: Tic Tac Toe (3x3 Online & Local) -->
      <template v-else-if="currentGame === 'ttt'">
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
          @start-ai="startSoloAIMatch"
          @start-pass="startPassAndPlayMatch"
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
      </template>
    </main>

    <footer class="footer">
      <span>{{ t('footer_note') }}</span>
    </footer>
  </div>
</template>
