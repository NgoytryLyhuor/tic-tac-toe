<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  applyMovePawn,
  applyPlaceWall,
  createBarricadeState,
  getBestAIMove,
  getLegalMoves,
  isValidWallPlacement,
  normalizeCode,
  normalizeName,
} from '../lib/barricadeLogic.js'
import { BarricadeSession } from '../lib/barricadeSession.js'
import {
  clearBarricadeSession,
  getPlayerId,
  loadBarricadeSession,
  loadName,
  saveBarricadeSession,
  saveName,
} from '../lib/player.js'
import {
  playClickSound,
  playDrawSound,
  playInvalidSound,
  playJoinSound,
  playStepSound,
  playWallDropSound,
  playWinSound,
} from '../lib/sound.js'
import { initTelegram } from '../lib/telegram.js'
import { t } from '../lib/i18n.js'

const props = defineProps({
  initialCode: {
    type: String,
    default: '',
  },
  initialBroker: {
    type: Number,
    default: -1,
  },
})

const emit = defineEmits(['back-to-hub'])
const telegram = initTelegram()
const playerId = getPlayerId()

// Setup & Mode Selection
const setupTab = ref('ai') // 'ai' | 'pvp'
const pvpSubTab = ref('online') // 'online' | 'pass'
const difficulty = ref('medium') // 'easy' | 'medium' | 'hard'
const inSetup = ref(true)

// Online PvP state
const onlineCode = ref(props.initialCode ? normalizeCode(props.initialCode) : '')
const playerName = ref(loadName() || telegram.user?.first_name || 'Player')
const onlineRoom = ref(null)
const onlineStatus = ref('idle')
const onlineError = ref('')
const brokerIndex = ref(-1)
const copied = ref('')
let session = null

// Local game state (Solo AI or Pass & Play)
const localState = ref(createBarricadeState('ai', 'medium'))
const activeMode = ref('ai') // 'ai' | 'pass' | 'online'

// In-game controls
const actionMode = ref('move') // 'move' | 'wall'
const wallOrientation = ref('H') // 'H' | 'V'
const isAiThinking = ref(false)
const toastMessage = ref('')
let toastTimer = null
let lastOnlineVersionHandled = null

function showToast(msg) {
  toastMessage.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
  }, 2200)
}

function generateRandomCode() {
  playClickSound()
  const words = ['WALL', 'MAZE', 'PATH', 'GATE', 'NEON', 'LOCK', 'RACE', 'STEP', 'BLOK']
  const word = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(Math.random() * 90 + 10)
  onlineCode.value = `${word}${num}`
}

// Active State Bridge
const state = computed(() => {
  if (activeMode.value === 'online' && onlineRoom.value) {
    return onlineRoom.value
  }
  return localState.value
})

const myPlayerIndex = computed(() => {
  if (activeMode.value === 'online' && onlineRoom.value) {
    return onlineRoom.value.you ?? 0
  }
  return 0
})

const isMyTurn = computed(() => {
  if (state.value.winner !== null) return false
  if (activeMode.value === 'pass') return true
  if (activeMode.value === 'online') {
    return state.value.status === 'playing' && state.value.turn === myPlayerIndex.value
  }
  return state.value.turn === 0
})

const p0 = computed(() => state.value.pawns?.[0] || { row: 8, col: 4 })
const p1 = computed(() => state.value.pawns?.[1] || { row: 0, col: 4 })
const walls0 = computed(() => state.value.wallsLeft?.[0] ?? 10)
const walls1 = computed(() => state.value.wallsLeft?.[1] ?? 10)
const currentWalls = computed(() => state.value.wallsLeft?.[state.value.turn] ?? 10)

// Clean, single-line player names that never wrap awkwardly
const p0Name = computed(() => {
  if (activeMode.value === 'online' && onlineRoom.value) {
    const hostName = onlineRoom.value.players?.[0]?.name || t('you_label')
    return myPlayerIndex.value === 0 ? t('you_label') : hostName
  }
  return activeMode.value === 'ai' ? t('you_label') : t('red_label')
})

const p1Name = computed(() => {
  if (activeMode.value === 'online' && onlineRoom.value) {
    const guestName = onlineRoom.value.players?.[1]?.name || t('waiting')
    return myPlayerIndex.value === 1 ? t('you_label') : guestName
  }
  return activeMode.value === 'ai' ? t('ai_label') : t('blue_label')
})

const p0Status = computed(() => {
  if (state.value.winner === 0) return t('winner_badge')
  if (state.value.winner !== null) return t('finished_badge')
  return state.value.turn === 0 ? t('turn_active') : t('waiting')
})

const p1Status = computed(() => {
  if (state.value.winner === 1) return t('winner_badge')
  if (state.value.winner !== null) return t('finished_badge')
  return state.value.turn === 1 ? t('turn_active') : t('waiting')
})

const legalMoves = computed(() => {
  if (state.value.winner !== null) return []
  if (activeMode.value === 'ai' && state.value.turn === 1) return []
  if (activeMode.value === 'online' && !isMyTurn.value) return []
  return getLegalMoves(state.value, state.value.turn)
})

function isCellLegalMove(r, c) {
  return legalMoves.value.some((m) => m.row === r && m.col === c)
}

function syncUrl(code) {
  try {
    const url = new URL(location.href)
    url.searchParams.set('game', 'barricade')
    if (code) url.searchParams.set('code', code)
    else url.searchParams.delete('code')
    history.replaceState({}, '', url)
  } catch {}
}

const inviteUrl = computed(() => {
  const c = onlineRoom.value?.code || onlineCode.value
  if (!c) return ''
  const params = new URLSearchParams({ game: 'barricade', code: c })
  if (brokerIndex.value >= 0) params.set('b', String(brokerIndex.value))
  return `${location.origin}${location.pathname}?${params.toString()}`
})

// Start Solo AI Match
function startAiMatch(diff = 'medium') {
  playClickSound()
  activeMode.value = 'ai'
  difficulty.value = diff
  localState.value = createBarricadeState('ai', diff)
  actionMode.value = 'move'
  wallOrientation.value = 'H'
  inSetup.value = false
  isAiThinking.value = false
  syncUrl('')
}

// Start Local Pass & Play Match
function startPassMatch() {
  playClickSound()
  activeMode.value = 'pass'
  localState.value = createBarricadeState('pass')
  actionMode.value = 'move'
  wallOrientation.value = 'H'
  inSetup.value = false
  isAiThinking.value = false
  syncUrl('')
}

// Start / Join Online Match
function startOnlineMatch(rawCode = onlineCode.value) {
  const norm = normalizeCode(rawCode)
  if (norm.length < 3) {
    showToast(t('toast_code_min'))
    telegram.haptic('warning')
    return
  }

  playClickSound()
  saveName(playerName.value.trim())
  saveBarricadeSession(norm)
  syncUrl(norm)

  activeMode.value = 'online'
  onlineCode.value = norm
  onlineError.value = ''
  inSetup.value = false
  actionMode.value = 'move'

  session?.stop()
  session = new BarricadeSession({
    playerId,
    onState: (next) => {
      const prev = onlineRoom.value
      onlineRoom.value = next

      if (next) {
        onlineError.value = ''
        if (next.code) {
          onlineCode.value = next.code
          saveBarricadeSession(next.code)
          syncUrl(next.code)
        }

        // Guest joined lobby
        if (prev?.status === 'waiting' && next.status === 'playing') {
          playJoinSound()
          telegram.haptic('success')
        }

        // Game finished
        if (next.status === 'finished' && next.winner !== null && lastOnlineVersionHandled !== next.version) {
          lastOnlineVersionHandled = next.version
          if (next.winner === next.you) {
            playWinSound()
            telegram.haptic('success')
          } else {
            playDrawSound()
            telegram.haptic('warning')
          }
        }
      }
    },
    onStatus: (status) => {
      onlineStatus.value = status
    },
    onError: (msg) => {
      onlineError.value = msg
      showToast(msg)
      telegram.haptic('error')
    },
    onBroker: (idx) => {
      brokerIndex.value = idx
    },
  })

  session.join(norm, playerName.value.trim(), props.initialBroker)
}

function leaveGame() {
  playClickSound()
  telegram.haptic('light')
  if (activeMode.value === 'online') {
    session?.leave()
    session = null
    onlineRoom.value = null
    clearBarricadeSession()
  }
  syncUrl('')
  inSetup.value = true
  activeMode.value = 'ai'
  localState.value = createBarricadeState('ai', difficulty.value)
  isAiThinking.value = false
}

function restartLocalGame() {
  playClickSound()
  localState.value = createBarricadeState(activeMode.value, difficulty.value)
  actionMode.value = 'move'
  isAiThinking.value = false
}

function requestOnlineRematch() {
  if (activeMode.value !== 'online' || !session) return
  playClickSound()
  telegram.haptic('light')
  const res = session.rematch()
  if (!res.ok) showToast(res.error)
}

// Interaction: Cell Click (Move Pawn)
function onCellClick(r, c) {
  if (!isMyTurn.value || isAiThinking.value) return

  if (isCellLegalMove(r, c)) {
    actionMode.value = 'move'

    if (activeMode.value === 'online') {
      telegram.haptic('light')
      playStepSound()
      const res = session.movePawn(r, c)
      if (!res.ok) {
        showToast(res.error)
        telegram.haptic('error')
        playInvalidSound()
      }
      return
    }

    // Local execution
    const res = applyMovePawn(localState.value, r, c)
    if (res.ok) {
      telegram.haptic('light')
      playStepSound()
      if (localState.value.winner !== null) {
        playWinSound()
        telegram.haptic('success')
      }
    } else {
      telegram.haptic('error')
      playInvalidSound()
      showToast(res.error)
    }
  }
}

// Interaction: Intersection Click (Place Wall)
function onIntersectionClick(r, c) {
  if (!isMyTurn.value || isAiThinking.value) return
  if (currentWalls.value <= 0) {
    showToast(t('toast_no_walls'))
    return
  }

  const valid = isValidWallPlacement(state.value, r, c, wallOrientation.value)
  if (!valid) {
    telegram.haptic('error')
    playInvalidSound()
    showToast(t('toast_block_all'))
    return
  }

  if (activeMode.value === 'online') {
    telegram.haptic('light')
    playWallDropSound()
    const res = session.placeWall(r, c, wallOrientation.value)
    if (!res.ok) {
      telegram.haptic('error')
      playInvalidSound()
      showToast(res.error)
    } else {
      actionMode.value = 'move'
    }
    return
  }

  // Local execution
  const res = applyPlaceWall(localState.value, r, c, wallOrientation.value)
  if (res.ok) {
    telegram.haptic('light')
    playWallDropSound()
    actionMode.value = 'move'
  } else {
    telegram.haptic('error')
    playInvalidSound()
    showToast(res.error)
  }
}

function isWallValid(r, c) {
  if (!isMyTurn.value || isAiThinking.value || currentWalls.value <= 0) return false
  return isValidWallPlacement(state.value, r, c, wallOrientation.value)
}

function toggleOrientation() {
  playClickSound()
  telegram.haptic('light')
  wallOrientation.value = wallOrientation.value === 'H' ? 'V' : 'H'
}

function toggleActionMode(mode) {
  playClickSound()
  telegram.haptic('light')
  actionMode.value = mode
}

// Positioning styles for Placed Walls
function getPlacedWallStyle(w) {
  if (w.orientation === 'H') {
    return {
      top: `calc(var(--p) + ${(w.row + 1)} * var(--cell) + ${w.row} * var(--g) - 1.5px)`,
      left: `calc(var(--p) + ${w.col} * (var(--cell) + var(--g)))`,
      width: `calc(2 * var(--cell) + var(--g))`,
      height: `calc(var(--g) + 3px)`,
    }
  } else {
    return {
      top: `calc(var(--p) + ${w.row} * (var(--cell) + var(--g)))`,
      left: `calc(var(--p) + ${(w.col + 1)} * var(--cell) + ${w.col} * var(--g) - 1.5px)`,
      height: `calc(2 * var(--cell) + var(--g))`,
      width: `calc(var(--g) + 3px)`,
    }
  }
}

// Positioning styles for Touch Targets
function getTouchTargetStyle(r, c) {
  return {
    top: `calc(var(--p) + ${(r + 1)} * var(--cell) + ${(r + 0.5)} * var(--g))`,
    left: `calc(var(--p) + ${(c + 1)} * var(--cell) + ${(c + 0.5)} * var(--g))`,
  }
}

// AI Turn Automation (Local Mode)
watch(
  () => localState.value.turn,
  (turn) => {
    if (activeMode.value === 'ai' && turn === 1 && localState.value.winner === null) {
      isAiThinking.value = true
      setTimeout(() => {
        const botAction = getBestAIMove(localState.value, difficulty.value)
        if (!botAction) {
          isAiThinking.value = false
          return
        }

        if (botAction.type === 'move') {
          applyMovePawn(localState.value, botAction.row, botAction.col)
          playStepSound()
          telegram.haptic('light')
        } else if (botAction.type === 'wall') {
          applyPlaceWall(localState.value, botAction.row, botAction.col, botAction.orientation)
          playWallDropSound()
          telegram.haptic('light')
        }

        if (localState.value.winner !== null) {
          if (localState.value.winner === 0) {
            playWinSound()
            telegram.haptic('success')
          } else {
            playInvalidSound()
            telegram.haptic('warning')
          }
        }
        isAiThinking.value = false
      }, 420)
    }
  },
)

const turnBannerText = computed(() => {
  if (state.value.winner !== null) {
    if (activeMode.value === 'ai') {
      return state.value.winner === 0 ? t('win_victory') : t('win_ai')
    }
    if (activeMode.value === 'online') {
      return state.value.winner === myPlayerIndex.value
        ? t('win_victory')
        : t('win_opp')
    }
    return state.value.winner === 0 ? t('win_red') : t('win_blue')
  }

  if (isAiThinking.value) {
    return t('ai_thinking')
  }

  if (activeMode.value === 'online' && !isMyTurn.value) {
    const oppName = myPlayerIndex.value === 0 ? (onlineRoom.value?.players?.[1]?.name || t('waiting')) : (onlineRoom.value?.players?.[0]?.name || t('waiting'))
    return t('opp_thinking', { name: oppName })
  }

  if (actionMode.value === 'wall') {
    return t('your_turn_wall')
  }

  if (activeMode.value === 'pass') {
    return state.value.turn === 0 ? t('red_turn_pass') : t('blue_turn_pass')
  }

  return t('your_turn_move')
})

async function shareInvite() {
  playClickSound()
  telegram.haptic('light')
  const url = inviteUrl.value
  const matchCode = onlineRoom.value?.code || onlineCode.value
  const shareData = {
    title: t('barricade_title'),
    text: `${t('barricade_title')} - Code: ${matchCode}`,
    url: url,
  }

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData)
      return
    } catch {}
  }

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
    } catch {}
    document.body.removeChild(area)
  }

  copied.value = label
  setTimeout(() => {
    if (copied.value === label) copied.value = ''
  }, 2000)
}

const copyCode = () => copyText(onlineRoom.value?.code || onlineCode.value, 'code')
const copyLink = () => copyText(inviteUrl.value, 'link')

onMounted(() => {
  if (props.initialCode) {
    setupTab.value = 'pvp'
    pvpSubTab.value = 'online'
    onlineCode.value = normalizeCode(props.initialCode)
    if (loadName() || telegram.user?.first_name) {
      startOnlineMatch(onlineCode.value)
    }
  } else {
    const saved = loadBarricadeSession()
    if (saved && (loadName() || telegram.user?.first_name)) {
      onlineCode.value = saved
    }
  }
})

onBeforeUnmount(() => {
  session?.stop()
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="barricade-wrapper">
    <!-- Setup Mode Picker -->
    <section v-if="inSetup" class="card setup-card">
      <div class="setup-header">
        <span class="hub-icon-badge barricade-icon">🧱</span>
        <h2>{{ t('barricade_title') }}</h2>
        <p class="lede">{{ t('barricade_lede') }}</p>
      </div>

      <!-- Top Mode Switcher: Solo vs 2 Players -->
      <div class="mode-tabs">
        <button
          type="button"
          class="mode-tab-btn"
          :class="{ active: setupTab === 'ai' }"
          @click="setupTab = 'ai'"
        >
          <span class="tab-icon">🤖</span>
          <span class="tab-label">{{ t('tab_vs_computer') }}</span>
        </button>
        <button
          type="button"
          class="mode-tab-btn"
          :class="{ active: setupTab === 'pvp' }"
          @click="setupTab = 'pvp'"
        >
          <span class="tab-icon">👥</span>
          <span class="tab-label">{{ t('tab_pvp') }}</span>
        </button>
      </div>

      <!-- Tab 1: vs Computer (Solo) -->
      <div v-if="setupTab === 'ai'" class="ai-setup-pane">
        <div class="field">
          <span>{{ t('ai_diff_label') }}</span>
          <div class="diff-buttons">
            <button
              class="btn small"
              type="button"
              :class="difficulty === 'easy' ? 'primary' : 'ghost'"
              @click="difficulty = 'easy'"
            >
              {{ t('diff_easy') }}
            </button>
            <button
              class="btn small"
              type="button"
              :class="difficulty === 'medium' ? 'primary' : 'ghost'"
              @click="difficulty = 'medium'"
            >
              {{ t('diff_medium') }}
            </button>
            <button
              class="btn small"
              type="button"
              :class="difficulty === 'hard' ? 'primary' : 'ghost'"
              @click="difficulty = 'hard'"
            >
              {{ t('diff_hard') }}
            </button>
          </div>
          <small class="diff-help">{{ t('diff_help') }}</small>
        </div>

        <button class="btn primary main-cta" type="button" @click="startAiMatch(difficulty)">
          <span>{{ t('btn_play_ai') }}</span>
          <span class="arrow-icon">→</span>
        </button>
      </div>

      <!-- Tab 2: 2 Players (PvP) with Online 2-Phone & Pass & Play -->
      <div v-else class="pvp-setup-pane">
        <!-- Sub-segmented control: Online 2-Phone vs Pass & Play 1-Phone -->
        <div class="sub-tabs">
          <button
            type="button"
            class="sub-tab-btn"
            :class="{ active: pvpSubTab === 'online' }"
            @click="pvpSubTab = 'online'"
          >
            <span class="sub-icon">🌐</span>
            <span>{{ t('subtab_online') }}</span>
          </button>
          <button
            type="button"
            class="sub-tab-btn"
            :class="{ active: pvpSubTab === 'pass' }"
            @click="pvpSubTab = 'pass'"
          >
            <span class="sub-icon">📱</span>
            <span>{{ t('subtab_pass') }}</span>
          </button>
        </div>

        <!-- Online (2 Phones via Room Code) -->
        <div v-if="pvpSubTab === 'online'" class="online-setup-box">
          <div class="field">
            <label for="barricade-room-code">{{ t('match_code_label') }}</label>
            <div class="code-input-row">
              <input
                id="barricade-room-code"
                v-model="onlineCode"
                type="text"
                maxlength="8"
                :placeholder="t('match_code_placeholder')"
                class="input-code"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                @input="onlineCode = normalizeCode($event.target.value)"
              />
              <button
                type="button"
                class="btn ghost dice-btn"
                title="Random Code"
                @click="generateRandomCode"
              >
                🎲
              </button>
            </div>
            <small class="field-hint">{{ t('match_code_hint') }}</small>
          </div>

          <div class="field">
            <label for="barricade-player-name">{{ t('nickname_label') }}</label>
            <input
              id="barricade-player-name"
              v-model="playerName"
              type="text"
              maxlength="20"
              :placeholder="t('nickname_placeholder')"
              class="input-name"
            />
          </div>

          <button
            class="btn primary main-cta"
            type="button"
            :disabled="!onlineCode || onlineCode.length < 3"
            @click="startOnlineMatch(onlineCode)"
          >
            <span>{{ t('btn_start_online') }}</span>
            <span class="arrow-icon">→</span>
          </button>

          <div class="online-steps">
            <span class="step-badge">{{ t('step_1') }}</span>
            <span class="step-sep">·</span>
            <span class="step-badge">{{ t('step_2') }}</span>
            <span class="step-sep">·</span>
            <span class="step-badge">{{ t('step_3') }}</span>
          </div>
        </div>

        <!-- Pass & Play (1 Phone) -->
        <div v-else class="pass-setup-box">
          <p class="pass-desc">{{ t('pass_desc') }}</p>

          <button class="btn primary main-cta" type="button" @click="startPassMatch">
            <span>{{ t('btn_start_pass') }}</span>
            <span class="arrow-icon">→</span>
          </button>
        </div>
      </div>

      <button class="btn link small back-hub-btn" type="button" @click="emit('back-to-hub')">
        {{ t('btn_back_hub') }}
      </button>
    </section>

    <!-- Online Lobby Screen: Waiting for 2nd Phone to Join -->
    <section
      v-else-if="activeMode === 'online' && onlineRoom && onlineRoom.status === 'waiting'"
      class="card lobby-card"
    >
      <header class="lobby-header">
        <span class="hub-icon-badge barricade-icon">🧱</span>
        <h2>{{ t('lobby_title') }}</h2>
        <p class="lede">{{ t('lobby_lede') }}</p>
      </header>

      <div class="code-banner">
        <span class="code-chip-huge">{{ onlineRoom.code }}</span>
      </div>

      <div class="lobby-actions">
        <button class="btn primary full share-btn" type="button" @click="shareInvite">
          <span>{{ t('btn_share_link') }}</span>
        </button>

        <div class="copy-row">
          <button class="btn ghost small" type="button" @click="copyCode">
            {{ copied === 'code' ? t('btn_copied_code') : t('btn_copy_code') }}
          </button>
          <button class="btn ghost small" type="button" @click="copyLink">
            {{ copied === 'link' ? t('btn_copied_link') : t('btn_copy_link') }}
          </button>
        </div>
      </div>

      <div class="waiting-indicator">
        <span class="spinner" aria-hidden="true"></span>
        <span class="waiting-text">{{ t('waiting_phone2') }}</span>
      </div>

      <button class="btn link danger small back-setup-btn" type="button" @click="leaveGame">
        {{ t('btn_cancel_code') }}
      </button>
    </section>

    <!-- Main Game Board Screen -->
    <section v-else class="card game-card">
      <!-- Top Bar -->
      <header class="barricade-top">
        <button class="btn link small" type="button" @click="leaveGame">
          {{ activeMode === 'online' ? t('btn_leave') : t('btn_mode') }}
        </button>

        <!-- Center Match Tag / Code Chip -->
        <div class="top-tag-wrapper">
          <template v-if="activeMode === 'online'">
            <button class="code-pill-btn" type="button" title="Click to copy invite" @click="shareInvite">
              <span class="pulse-dot" :class="{ offline: !onlineRoom?.opponentOnline }"></span>
              <strong class="code-text">{{ onlineRoom?.code }}</strong>
              <small class="round-badge">{{ t('round_badge') }}{{ state.round || 1 }}</small>
            </button>
          </template>
          <span v-else class="game-tag">
            {{ activeMode === 'ai' ? `vs AI (${difficulty})` : t('subtab_pass') }}
          </span>
        </div>

        <button
          v-if="activeMode !== 'online'"
          class="btn link danger small"
          type="button"
          @click="restartLocalGame"
        >
          {{ t('btn_restart') }}
        </button>
        <button
          v-else
          class="btn link small"
          type="button"
          title="Share Invite"
          @click="shareInvite"
        >
          {{ t('btn_share') }}
        </button>
      </header>

      <!-- Player HUD: Clean single-line cards with Avatars, Names, Status & Sleek Wall Racks -->
      <div class="racks-row">
        <!-- Player 0 (Red / Bottom) -->
        <div
          class="player-hud"
          :class="{
            active: state.turn === 0 && state.winner === null,
            winner: state.winner === 0,
            'is-you': activeMode === 'online' && myPlayerIndex === 0,
          }"
        >
          <div class="hud-left">
            <span class="pawn-pip red-pip"></span>
            <div class="hud-info">
              <strong class="hud-name">{{ p0Name }}</strong>
              <span class="hud-status">{{ p0Status }}</span>
            </div>
          </div>
          <div class="wall-rack" :title="t('walls_title')">
            <div class="wall-sticks">
              <span
                v-for="i in 10"
                :key="i"
                class="wall-stick red-stick"
                :class="{ spent: i > walls0 }"
              ></span>
            </div>
            <span class="wall-count">{{ walls0 }}</span>
          </div>
        </div>

        <!-- Player 1 (Blue / Top) -->
        <div
          class="player-hud"
          :class="{
            active: state.turn === 1 && state.winner === null,
            winner: state.winner === 1,
            'is-you': activeMode === 'online' && myPlayerIndex === 1,
          }"
        >
          <div class="hud-left">
            <span class="pawn-pip blue-pip"></span>
            <div class="hud-info">
              <strong class="hud-name">{{ p1Name }}</strong>
              <span class="hud-status">{{ p1Status }}</span>
            </div>
          </div>
          <div class="wall-rack" :title="t('walls_title')">
            <div class="wall-sticks">
              <span
                v-for="i in 10"
                :key="i"
                class="wall-stick blue-stick"
                :class="{ spent: i > walls1 }"
              ></span>
            </div>
            <span class="wall-count">{{ walls1 }}</span>
          </div>
        </div>
      </div>

      <!-- Turn & Status Banner -->
      <div
        class="turn-banner"
        :class="{
          'turn-mine': isMyTurn && actionMode === 'move',
          warn: isAiThinking || actionMode === 'wall' || (activeMode === 'online' && !isMyTurn),
          win: state.winner !== null,
        }"
      >
        <span v-if="isAiThinking" class="spinner small" aria-hidden="true"></span>
        <span class="banner-text">{{ turnBannerText }}</span>
      </div>

      <!-- Rematch Callout (Shown when Round Ends) -->
      <div v-if="state.winner !== null" class="rematch-box">
        <template v-if="activeMode === 'online'">
          <button
            class="btn primary full rematch-btn"
            type="button"
            :disabled="Boolean(state.rematch?.[myPlayerIndex])"
            @click="requestOnlineRematch"
          >
            {{ state.rematch?.[myPlayerIndex] ? t('btn_waiting_rematch') : t('btn_rematch') }}
          </button>
          <small class="rematch-subtext">{{ t('rematch_note') }}</small>
        </template>
        <template v-else>
          <button class="btn primary full rematch-btn" type="button" @click="restartLocalGame">
            {{ t('btn_play_again') }}
          </button>
        </template>
      </div>

      <!-- 9x9 Board with Grooves & Placed Barricades -->
      <div class="board-container" style="--p: 6px; --g: 5px; --cell: calc((100% - 52px) / 9);">
        <div class="quoridor-grid">
          <!-- 81 Squares (9x9) -->
          <template v-for="r in 9" :key="`row-${r}`">
            <button
              v-for="c in 9"
              :key="`cell-${r-1}-${c-1}`"
              type="button"
              class="grid-cell"
              :class="{
                'target-row-0': r - 1 === 0,
                'target-row-8': r - 1 === 8,
                'legal-target': isCellLegalMove(r - 1, c - 1),
              }"
              :disabled="!isCellLegalMove(r - 1, c - 1) && !(p0.row === r - 1 && p0.col === c - 1) && !(p1.row === r - 1 && p1.col === c - 1)"
              :aria-label="`Row ${r}, Col ${c}`"
              @click="onCellClick(r - 1, c - 1)"
            >
              <!-- Pawn 0 (Red / Bottom) -->
              <span
                v-if="p0.row === r - 1 && p0.col === c - 1"
                class="pawn red-pawn"
                title="Red"
              ></span>
              <!-- Pawn 1 (Blue / Top) -->
              <span
                v-else-if="p1.row === r - 1 && p1.col === c - 1"
                class="pawn blue-pawn"
                title="Blue"
              ></span>
              <!-- Legal Move Hint Dot -->
              <span
                v-else-if="isCellLegalMove(r - 1, c - 1)"
                class="legal-indicator"
              ></span>
            </button>
          </template>
        </div>

        <!-- Rendered Placed Barricades (3D Wooden Walls) -->
        <div
          v-for="(w, idx) in state.walls"
          :key="`placed-${idx}`"
          class="placed-wall"
          :class="[w.orientation === 'H' ? 'placed-wall-h' : 'placed-wall-v', w.placedBy === 0 ? 'red-wall' : 'blue-wall']"
          :style="getPlacedWallStyle(w)"
        ></div>

        <!-- Touch Targets Layer: 64 Intersection Anchors (Active only in Wall mode) -->
        <div v-if="actionMode === 'wall'" class="touch-intersections-layer">
          <template v-for="r in 8" :key="`touch-r-${r}`">
            <button
              v-for="c in 8"
              :key="`touch-${r-1}-${c-1}`"
              type="button"
              class="wall-touch-target"
              :class="{
                'is-valid': isWallValid(r - 1, c - 1),
                'preview-h': wallOrientation === 'H',
                'preview-v': wallOrientation === 'V',
              }"
              :style="getTouchTargetStyle(r - 1, c - 1)"
              :title="`Drop wall at (${r},${c})`"
              @click="onIntersectionClick(r - 1, c - 1)"
            >
              <span class="touch-dot"></span>
              <span class="wall-ghost-preview"></span>
            </button>
          </template>
        </div>
      </div>

      <!-- Action Dock: Move vs Wall Mode & Rotate -->
      <footer class="action-dock">
        <button
          type="button"
          class="btn dock-btn"
          :class="{ primary: actionMode === 'move', ghost: actionMode !== 'move' }"
          @click="toggleActionMode('move')"
        >
          <span class="dock-icon">🏃</span>
          <span class="dock-label">{{ t('btn_move') }}</span>
        </button>

        <button
          type="button"
          class="btn dock-btn"
          :class="{ primary: actionMode === 'wall', ghost: actionMode !== 'wall' }"
          :disabled="currentWalls === 0 || !isMyTurn || isAiThinking"
          @click="toggleActionMode('wall')"
        >
          <span class="dock-icon">🧱</span>
          <span class="dock-label">{{ t('btn_wall') }} ({{ currentWalls }})</span>
        </button>

        <button
          type="button"
          class="btn dock-btn rotate-btn"
          :class="{ active: actionMode === 'wall' }"
          title="Orientation"
          @click="toggleOrientation"
        >
          <span class="dock-icon">{{ wallOrientation === 'H' ? '━' : '┃' }}</span>
          <span class="dock-label">{{ wallOrientation === 'H' ? t('btn_horiz') : t('btn_vert') }}</span>
        </button>
      </footer>

      <!-- Toast Feedback -->
      <p v-if="toastMessage" class="toast-alert alert warn" role="alert">
        {{ toastMessage }}
      </p>
    </section>
  </div>
</template>
