<script setup>
import { computed, ref, watch } from 'vue'
import {
  applyMovePawn,
  applyPlaceWall,
  createBarricadeState,
  getBestAIMove,
  getLegalMoves,
  isValidWallPlacement,
} from '../lib/barricadeLogic.js'
import {
  playClickSound,
  playInvalidSound,
  playStepSound,
  playWallDropSound,
  playWinSound,
} from '../lib/sound.js'
import { initTelegram } from '../lib/telegram.js'

const emit = defineEmits(['back-to-hub'])
const telegram = initTelegram()

// Game setup & mode
const setupTab = ref('ai') // 'ai' | 'pass'
const gameMode = ref('ai') // 'ai' | 'pass'
const difficulty = ref('medium') // 'easy' | 'medium' | 'hard'
const inSetup = ref(true)

// Core state
const state = ref(createBarricadeState(gameMode.value, difficulty.value))
const actionMode = ref('move') // 'move' | 'wall'
const wallOrientation = ref('H') // 'H' | 'V'
const isAiThinking = ref(false)
const toastMessage = ref('')
let toastTimer = null

function showToast(msg) {
  toastMessage.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
  }, 2200)
}

function startGame(mode, diff = 'medium') {
  playClickSound()
  gameMode.value = mode
  difficulty.value = diff
  setupTab.value = mode
  state.value = createBarricadeState(mode, diff)
  actionMode.value = 'move'
  wallOrientation.value = 'H'
  inSetup.value = false
  isAiThinking.value = false
}

function restartGame() {
  playClickSound()
  state.value = createBarricadeState(gameMode.value, difficulty.value)
  actionMode.value = 'move'
  isAiThinking.value = false
}

const p0 = computed(() => state.value.pawns[0])
const p1 = computed(() => state.value.pawns[1])
const walls0 = computed(() => state.value.wallsLeft[0])
const walls1 = computed(() => state.value.wallsLeft[1])
const currentWalls = computed(() => state.value.wallsLeft[state.value.turn])

// Current legal moves for pawn
const legalMoves = computed(() => {
  if (state.value.winner !== null) return []
  if (gameMode.value === 'ai' && state.value.turn === 1) return []
  return getLegalMoves(state.value, state.value.turn)
})

function isCellLegalMove(r, c) {
  return legalMoves.value.some((m) => m.row === r && m.col === c)
}

// Player turns
const isMyTurn = computed(() => {
  if (state.value.winner !== null) return false
  if (gameMode.value === 'pass') return true
  return state.value.turn === 0
})

// Execute Human Move
function onCellClick(r, c) {
  if (!isMyTurn.value || isAiThinking.value) return

  // In move mode or tapping legal target: move pawn
  if (isCellLegalMove(r, c)) {
    actionMode.value = 'move'
    const res = applyMovePawn(state.value, r, c)
    if (res.ok) {
      telegram.haptic('light')
      playStepSound()
      if (state.value.winner !== null) {
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

// Execute Wall Placement
function onIntersectionClick(r, c) {
  if (!isMyTurn.value || isAiThinking.value) return
  if (currentWalls.value <= 0) {
    showToast('No walls remaining!')
    return
  }

  const valid = isValidWallPlacement(state.value, r, c, wallOrientation.value)
  if (!valid) {
    telegram.haptic('error')
    playInvalidSound()
    showToast('Cannot block all paths to goal!')
    return
  }

  const res = applyPlaceWall(state.value, r, c, wallOrientation.value)
  if (res.ok) {
    telegram.haptic('light')
    playWallDropSound()
    // Auto return to move mode for smooth flow
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

// AI Turn Automation
watch(
  () => state.value.turn,
  (turn) => {
    if (gameMode.value === 'ai' && turn === 1 && state.value.winner === null) {
      isAiThinking.value = true
      setTimeout(() => {
        const botAction = getBestAIMove(state.value, difficulty.value)
        if (!botAction) {
          isAiThinking.value = false
          return
        }

        if (botAction.type === 'move') {
          applyMovePawn(state.value, botAction.row, botAction.col)
          playStepSound()
          telegram.haptic('light')
        } else if (botAction.type === 'wall') {
          applyPlaceWall(state.value, botAction.row, botAction.col, botAction.orientation)
          playWallDropSound()
          telegram.haptic('light')
        }

        if (state.value.winner !== null) {
          if (state.value.winner === 0) {
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
    if (gameMode.value === 'ai') {
      return state.value.winner === 0 ? '🏆 Victory! You reached the goal!' : '🤖 AI Won this round!'
    }
    return state.value.winner === 0 ? '🏆 Red Player Won!' : '🏆 Blue Player Won!'
  }
  if (isAiThinking.value) {
    return '🤖 AI is planning next move…'
  }
  if (actionMode.value === 'wall') {
    return '🧱 Wall Mode: Tap any golden dot to drop wall'
  }
  if (gameMode.value === 'pass') {
    return state.value.turn === 0 ? "Red's Turn — Tap green square to move" : "Blue's Turn — Tap green square to move"
  }
  return 'Your Turn — Tap green square to move'
})
</script>

<template>
  <div class="barricade-wrapper">
    <!-- Setup Mode Picker -->
    <section v-if="inSetup" class="card setup-card">
      <div class="setup-header">
        <span class="hub-icon-badge barricade-icon">🧱</span>
        <h2>Barricade (Quoridor)</h2>
        <p class="lede">Race your pawn to the opposite side. Place walls to trap your opponent!</p>
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
          <span class="tab-label">vs Computer</span>
        </button>
        <button
          type="button"
          class="mode-tab-btn"
          :class="{ active: setupTab === 'pass' }"
          @click="setupTab = 'pass'"
        >
          <span class="tab-icon">👥</span>
          <span class="tab-label">2 Players (PvP)</span>
        </button>
      </div>

      <!-- Tab 1: vs Computer (Solo) -->
      <div v-if="setupTab === 'ai'" class="ai-setup-pane">
        <div class="field">
          <span>AI Difficulty</span>
          <div class="diff-buttons">
            <button
              class="btn small"
              type="button"
              :class="difficulty === 'easy' ? 'primary' : 'ghost'"
              @click="difficulty = 'easy'"
            >
              Easy
            </button>
            <button
              class="btn small"
              type="button"
              :class="difficulty === 'medium' ? 'primary' : 'ghost'"
              @click="difficulty = 'medium'"
            >
              Medium ⭐
            </button>
            <button
              class="btn small"
              type="button"
              :class="difficulty === 'hard' ? 'primary' : 'ghost'"
              @click="difficulty = 'hard'"
            >
              Hard ⚔️
            </button>
          </div>
          <small class="diff-help">Smart pathfinding bot that builds barricades and shortcuts.</small>
        </div>

        <button class="btn primary main-cta" type="button" @click="startGame('ai', difficulty)">
          <span>Play Solo vs AI</span>
          <span class="arrow-icon">→</span>
        </button>
      </div>

      <!-- Tab 2: Pass & Play (2 Players) -->
      <div v-else class="pass-setup-pane">
        <p class="pass-desc">
          Take turns moving pawns and placing 10 wooden barricades on this same device. No internet required!
        </p>

        <button class="btn primary main-cta" type="button" @click="startGame('pass')">
          <span>Start 2-Player Match</span>
          <span class="arrow-icon">→</span>
        </button>
      </div>

      <button class="btn link small back-hub-btn" type="button" @click="emit('back-to-hub')">
        ← Back to Games Hub
      </button>
    </section>

    <!-- Main Game Screen -->
    <section v-else class="card game-card">
      <!-- Top Bar -->
      <header class="barricade-top">
        <button class="btn link small" type="button" @click="inSetup = true">
          ← Mode
        </button>
        <span class="game-tag">
          {{ gameMode === 'ai' ? `vs AI (${difficulty})` : 'Pass & Play' }}
        </span>
        <button class="btn link danger small" type="button" @click="restartGame">
          Restart
        </button>
      </header>

      <!-- Player HUD: Beautiful dual-cards with avatars, turns & wall racks -->
      <div class="racks-row">
        <!-- Player 0 (Red / You) -->
        <div class="player-hud" :class="{ active: state.turn === 0, winner: state.winner === 0 }">
          <div class="hud-left">
            <span class="pawn-pip red-pip"></span>
            <div class="hud-info">
              <strong class="hud-name">{{ gameMode === 'ai' ? 'You' : 'Red' }}</strong>
              <span class="hud-status">{{ state.turn === 0 ? 'Your Turn' : 'Waiting' }}</span>
            </div>
          </div>
          <div class="wall-rack" title="Walls Remaining">
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

        <!-- Player 1 (Blue / AI) -->
        <div class="player-hud" :class="{ active: state.turn === 1, winner: state.winner === 1 }">
          <div class="hud-left">
            <span class="pawn-pip blue-pip"></span>
            <div class="hud-info">
              <strong class="hud-name">{{ gameMode === 'ai' ? 'AI' : 'Blue' }}</strong>
              <span class="hud-status">{{ state.turn === 1 ? 'AI Turn' : 'Waiting' }}</span>
            </div>
          </div>
          <div class="wall-rack" title="Walls Remaining">
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
          warn: isAiThinking || actionMode === 'wall',
          win: state.winner !== null,
        }"
      >
        <span v-if="isAiThinking" class="spinner small" aria-hidden="true"></span>
        <span class="banner-text">{{ turnBannerText }}</span>
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
              <!-- Pawn 0 (Red / You) -->
              <span
                v-if="p0.row === r - 1 && p0.col === c - 1"
                class="pawn red-pawn"
                title="Your Pawn"
              ></span>
              <!-- Pawn 1 (Blue / AI) -->
              <span
                v-else-if="p1.row === r - 1 && p1.col === c - 1"
                class="pawn blue-pawn"
                title="Opponent Pawn"
              ></span>
              <!-- Legal Move Hint Dot -->
              <span
                v-else-if="isCellLegalMove(r - 1, c - 1)"
                class="legal-indicator"
              ></span>
            </button>
          </template>
        </div>

        <!-- Rendered Placed Barricades (High Visibility 3D Wooden Walls) -->
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
              :title="`Drop ${wallOrientation === 'H' ? 'horizontal' : 'vertical'} wall at (${r},${c})`"
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
          <span class="dock-label">Move</span>
        </button>

        <button
          type="button"
          class="btn dock-btn"
          :class="{ primary: actionMode === 'wall', ghost: actionMode !== 'wall' }"
          :disabled="currentWalls === 0 || !isMyTurn || isAiThinking"
          @click="toggleActionMode('wall')"
        >
          <span class="dock-icon">🧱</span>
          <span class="dock-label">Wall ({{ currentWalls }})</span>
        </button>

        <button
          type="button"
          class="btn dock-btn rotate-btn"
          :class="{ active: actionMode === 'wall' }"
          title="Toggle Horizontal or Vertical wall orientation"
          @click="toggleOrientation"
        >
          <span class="dock-icon">{{ wallOrientation === 'H' ? '━' : '┃' }}</span>
          <span class="dock-label">{{ wallOrientation === 'H' ? 'Horiz' : 'Vert' }}</span>
        </button>
      </footer>

      <!-- Toast Feedback -->
      <p v-if="toastMessage" class="toast-alert alert warn" role="alert">
        {{ toastMessage }}
      </p>
    </section>
  </div>
</template>
