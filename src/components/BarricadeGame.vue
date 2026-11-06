<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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

  // In move mode: check if tapped cell is legal
  if (isCellLegalMove(r, c)) {
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
  if (actionMode.value !== 'wall') {
    actionMode.value = 'wall'
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
    // Auto return to move mode for convenience
    actionMode.value = 'move'
  } else {
    telegram.haptic('error')
    playInvalidSound()
    showToast(res.error)
  }
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
      return state.value.winner === 0 ? '🏆 You Won!' : '🤖 AI Won this round!'
    }
    return state.value.winner === 0 ? '🏆 Red Player Won!' : '🏆 Blue Player Won!'
  }
  if (isAiThinking.value) {
    return '🤖 AI is planning next move…'
  }
  if (gameMode.value === 'pass') {
    return state.value.turn === 0 ? "Red's Turn — Move or place wall" : "Blue's Turn — Move or place wall"
  }
  return state.value.turn === 0 ? 'Your Turn — Move or place wall' : 'Opponent Turn…'
})

function getHWallStyle(r, c) {
  const top = (r * 100) / 9
  const left = ((c - 1) * 100) / 9
  const width = 200 / 9
  return {
    top: `calc(${top}% - 3.5px)`,
    left: `calc(${left}% + 4px)`,
    width: `calc(${width}% - 8px)`,
  }
}

function getVWallStyle(r, c) {
  const left = (c * 100) / 9
  const top = ((r - 1) * 100) / 9
  const height = 200 / 9
  return {
    left: `calc(${left}% - 3.5px)`,
    top: `calc(${top}% + 4px)`,
    height: `calc(${height}% - 8px)`,
  }
}

function getIntersectionStyle(r, c) {
  const top = (r * 100) / 9
  const left = (c * 100) / 9
  return {
    top: `calc(${top}% - 10px)`,
    left: `calc(${left}% - 10px)`,
  }
}

const p0 = computed(() => state.value.pawns[0])
const p1 = computed(() => state.value.pawns[1])
const walls0 = computed(() => state.value.wallsLeft[0])
const walls1 = computed(() => state.value.wallsLeft[1])
const currentWalls = computed(() => state.value.wallsLeft[state.value.turn])

function hasHWall(r, c) {
  return state.value.walls.some((w) => w.orientation === 'H' && w.row === r && w.col === c)
}

function hasVWall(r, c) {
  return state.value.walls.some((w) => w.orientation === 'V' && w.row === r && w.col === c)
}

function hasIntersectionWall(r, c) {
  return state.value.walls.some((w) => w.row === r && w.col === c)
}
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

    <!-- Main Game Board -->
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

      <!-- Player Racks (Walls remaining) -->
      <div class="racks-row">
        <!-- Player 0 (Bottom / Red) -->
        <div class="rack-badge" :class="{ active: state.turn === 0 }">
          <span class="pawn-pip red-pip"></span>
          <span class="rack-name">{{ gameMode === 'ai' ? 'You' : 'Red' }}</span>
          <div class="wall-sticks">
            <span
              v-for="w in walls0"
              :key="w"
              class="wall-stick red"
            ></span>
          </div>
          <span class="rack-num">{{ walls0 }}</span>
        </div>

        <!-- Player 1 (Top / Blue) -->
        <div class="rack-badge" :class="{ active: state.turn === 1 }">
          <span class="pawn-pip blue-pip"></span>
          <span class="rack-name">{{ gameMode === 'ai' ? 'AI' : 'Blue' }}</span>
          <div class="wall-sticks">
            <span
              v-for="w in walls1"
              :key="w"
              class="wall-stick blue"
            ></span>
          </div>
          <span class="rack-num">{{ walls1 }}</span>
        </div>
      </div>

      <!-- Turn & Status Banner -->
      <div class="turn-banner" :class="{ 'turn-mine': isMyTurn, warn: isAiThinking }">
        <span v-if="isAiThinking" class="spinner small" aria-hidden="true"></span>
        <span class="banner-text">{{ turnBannerText }}</span>
      </div>

      <!-- 9x9 Board -->
      <div class="board-container">
        <div class="quoridor-grid">
          <!-- 81 Squares (9x9) -->
          <template v-for="r in 9" :key="`row-${r}`">
            <button
              v-for="c in 9"
              :key="`cell-${r-1}-${c-1}`"
              type="button"
              class="q-cell"
              :class="{
                'has-p0': p0.row === r - 1 && p0.col === c - 1,
                'has-p1': p1.row === r - 1 && p1.col === c - 1,
                legal: isCellLegalMove(r - 1, c - 1),
                target0: r - 1 === 0,
                target1: r - 1 === 8,
              }"
              :disabled="!isCellLegalMove(r - 1, c - 1) && !(p0.row === r - 1 && p0.col === c - 1) && !(p1.row === r - 1 && p1.col === c - 1)"
              @click="onCellClick(r - 1, c - 1)"
            >
              <!-- Pawn 0 (Red / You) -->
              <span
                v-if="p0.row === r - 1 && p0.col === c - 1"
                class="pawn red-pawn"
              ></span>
              <!-- Pawn 1 (Blue / Opponent) -->
              <span
                v-else-if="p1.row === r - 1 && p1.col === c - 1"
                class="pawn blue-pawn"
              ></span>
              <!-- Legal Move Hint Dot -->
              <span
                v-else-if="isCellLegalMove(r - 1, c - 1)"
                class="move-hint"
              ></span>
            </button>
          </template>
        </div>

        <!-- Horizontal Walls (8 rows x 8 cols) -->
        <div class="h-walls-overlay">
          <template v-for="r in 8" :key="`hw-r-${r}`">
            <span
              v-for="c in 8"
              :key="`hw-${r-1}-${c-1}`"
              class="wall-slot h-slot"
              :class="{ placed: hasHWall(r - 1, c - 1) }"
              :style="getHWallStyle(r, c)"
            ></span>
          </template>
        </div>

        <!-- Vertical Walls (8 rows x 8 cols) -->
        <div class="v-walls-overlay">
          <template v-for="r in 8" :key="`vw-r-${r}`">
            <span
              v-for="c in 8"
              :key="`vw-${r-1}-${c-1}`"
              class="wall-slot v-slot"
              :class="{ placed: hasVWall(r - 1, c - 1) }"
              :style="getVWallStyle(r, c)"
            ></span>
          </template>
        </div>

        <!-- 64 Intersection Wall Anchors (8x8) -->
        <div class="intersections-grid">
          <template v-for="r in 8" :key="`int-r-${r}`">
            <button
              v-for="c in 8"
              :key="`int-${r-1}-${c-1}`"
              type="button"
              class="intersection-btn"
              :class="{
                'can-place': isMyTurn && !isAiThinking && currentWalls > 0 && !hasIntersectionWall(r - 1, c - 1),
                'preview-h': actionMode === 'wall' && wallOrientation === 'H',
                'preview-v': actionMode === 'wall' && wallOrientation === 'V',
              }"
              :style="getIntersectionStyle(r, c)"
              :title="`Place wall at intersection (${r},${c})`"
              @click="onIntersectionClick(r - 1, c - 1)"
            >
              <span class="crosshair"></span>
            </button>
          </template>
        </div>
      </div>

      <!-- Action Dock (Move vs Wall Mode & Rotate) -->
      <footer class="action-dock">
        <button
          type="button"
          class="dock-btn"
          :class="{ active: actionMode === 'move' }"
          @click="toggleActionMode('move')"
        >
          <span class="dock-icon">🏃</span>
          <span class="dock-label">Move</span>
        </button>

        <button
          type="button"
          class="dock-btn"
          :class="{ active: actionMode === 'wall' }"
          :disabled="currentWalls === 0"
          @click="toggleActionMode('wall')"
        >
          <span class="dock-icon">🧱</span>
          <span class="dock-label">Wall ({{ currentWalls }})</span>
        </button>

        <button
          type="button"
          class="dock-btn rotate-btn"
          :disabled="actionMode !== 'wall'"
          title="Toggle Horizontal / Vertical orientation"
          @click="toggleOrientation"
        >
          <span class="dock-icon">{{ wallOrientation === 'H' ? '━' : '┃' }}</span>
          <span class="dock-label">{{ wallOrientation === 'H' ? 'Horiz' : 'Vert' }}</span>
        </button>
      </footer>

      <!-- Toast Feedback -->
      <p v-if="toastMessage" class="barricade-toast" role="alert">
        {{ toastMessage }}
      </p>
    </section>
  </div>
</template>
