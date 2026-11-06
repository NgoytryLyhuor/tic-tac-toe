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

      <div class="mode-options">
        <div class="mode-box">
          <div class="mode-title">
            <span class="mode-icon">🤖</span>
            <div>
              <strong>Single Player vs AI</strong>
              <small>Play solo with an intelligent pathfinder bot</small>
            </div>
          </div>
          <div class="diff-buttons">
            <button class="btn ghost small" type="button" @click="startGame('ai', 'easy')">
              Easy
            </button>
            <button class="btn primary small" type="button" @click="startGame('ai', 'medium')">
              Medium
            </button>
            <button class="btn ghost small" type="button" @click="startGame('ai', 'hard')">
              Hard ⚔️
            </button>
          </div>
        </div>

        <div class="mode-box">
          <div class="mode-title">
            <span class="mode-icon">👥</span>
            <div>
              <strong>Pass & Play (2 Players)</strong>
              <small>Take turns on the same phone screen</small>
            </div>
          </div>
          <button class="btn ghost full" type="button" @click="startGame('pass')">
            Start 2-Player Match
          </button>
        </div>
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

      <!-- Player 1 / Top HUD (Blue) -->
      <div class="player-hud top-hud" :class="{ active: state.turn === 1, winner: state.winner === 1 }">
        <div class="hud-left">
          <span class="pawn-dot blue-pawn"></span>
          <div class="hud-names">
            <strong>{{ gameMode === 'ai' ? 'Bot (Blue)' : 'Player 2 (Blue)' }}</strong>
            <small>Target: Bottom row</small>
          </div>
        </div>
        <div class="wall-rack" title="Remaining Walls">
          <span
            v-for="i in 10"
            :key="i"
            class="wall-stick blue-stick"
            :class="{ spent: i > state.wallsLeft[1] }"
          ></span>
          <span class="wall-count">{{ state.wallsLeft[1] }}</span>
        </div>
      </div>

      <!-- Turn Banner -->
      <div class="turn-bar" :class="{ mine: state.turn === 0, win: state.winner !== null }">
        <span class="banner-msg">{{ turnBannerText }}</span>
      </div>

      <!-- 9x9 Board with Intersections for Walls -->
      <div class="board-container">
        <div class="quoridor-grid">
          <!-- 81 Cells -->
          <div
            v-for="idx in 81"
            :key="'cell-' + idx"
            class="grid-cell"
            :class="{
              'legal-target': isCellLegalMove(Math.floor((idx - 1) / 9), (idx - 1) % 9),
            }"
            @click="onCellClick(Math.floor((idx - 1) / 9), (idx - 1) % 9)"
          >
            <!-- Player 0 Pawn (Red) -->
            <div
              v-if="state.pawns[0].row === Math.floor((idx - 1) / 9) && state.pawns[0].col === (idx - 1) % 9"
              class="pawn red-pawn"
            ></div>

            <!-- Player 1 Pawn (Blue) -->
            <div
              v-else-if="state.pawns[1].row === Math.floor((idx - 1) / 9) && state.pawns[1].col === (idx - 1) % 9"
              class="pawn blue-pawn"
            ></div>

            <!-- Legal Move Dot Indicator -->
            <span
              v-else-if="isCellLegalMove(Math.floor((idx - 1) / 9), (idx - 1) % 9)"
              class="move-indicator-dot"
            ></span>
          </div>

          <!-- 64 Wall Intersection Touch Points -->
          <div
            v-for="interIdx in 64"
            :key="'inter-' + interIdx"
            class="wall-intersection"
            :style="{
              top: `calc(${((Math.floor((interIdx - 1) / 8) + 1) * 100) / 9}% - 8px)`,
              left: `calc(${(((interIdx - 1) % 8 + 1) * 100) / 9}% - 8px)`,
            }"
            :class="{
              'active-mode': actionMode === 'wall',
              'orient-h': wallOrientation === 'H',
              'orient-v': wallOrientation === 'V',
            }"
            @click.stop="onIntersectionClick(Math.floor((interIdx - 1) / 8), (interIdx - 1) % 8)"
          ></div>

          <!-- Rendered Placed Walls -->
          <div
            v-for="(w, wIdx) in state.walls"
            :key="'wall-' + wIdx"
            class="placed-wall"
            :class="[
              w.orientation === 'H' ? 'placed-wall-h' : 'placed-wall-v',
              w.placedBy === 0 ? 'red-wall' : 'blue-wall',
            ]"
            :style="
              w.orientation === 'H'
                ? {
                    top: `calc(${((w.row + 1) * 100) / 9}% - 3px)`,
                    left: `calc(${(w.col * 100) / 9}% + 4px)`,
                    width: `calc(${(2 * 100) / 9}% - 8px)`,
                  }
                : {
                    top: `calc(${(w.row * 100) / 9}% + 4px)`,
                    left: `calc(${((w.col + 1) * 100) / 9}% - 3px)`,
                    height: `calc(${(2 * 100) / 9}% - 8px)`,
                  }
            "
          ></div>
        </div>
      </div>

      <!-- Player 0 / Bottom HUD (Red / You) -->
      <div class="player-hud bottom-hud" :class="{ active: state.turn === 0, winner: state.winner === 0 }">
        <div class="hud-left">
          <span class="pawn-dot red-pawn"></span>
          <div class="hud-names">
            <strong>{{ gameMode === 'ai' ? 'You (Red)' : 'Player 1 (Red)' }}</strong>
            <small>Target: Top row</small>
          </div>
        </div>
        <div class="wall-rack" title="Remaining Walls">
          <span
            v-for="i in 10"
            :key="i"
            class="wall-stick red-stick"
            :class="{ spent: i > state.wallsLeft[0] }"
          ></span>
          <span class="wall-count">{{ state.wallsLeft[0] }}</span>
        </div>
      </div>

      <!-- Action Controls -->
      <div v-if="state.winner === null" class="action-dock">
        <button
          class="btn dock-btn"
          :class="actionMode === 'move' ? 'primary' : 'ghost'"
          type="button"
          @click="toggleActionMode('move')"
        >
          <span>🏃 Move Pawn</span>
        </button>

        <button
          class="btn dock-btn"
          :class="actionMode === 'wall' ? 'primary' : 'ghost'"
          type="button"
          :disabled="state.wallsLeft[state.turn] <= 0"
          @click="toggleActionMode('wall')"
        >
          <span>🧱 Place Wall</span>
        </button>

        <button
          v-if="actionMode === 'wall'"
          class="btn ghost rotate-btn"
          type="button"
          title="Rotate wall orientation"
          @click="toggleOrientation"
        >
          <span>🔄 {{ wallOrientation === 'H' ? 'Horizontal' : 'Vertical' }}</span>
        </button>
      </div>

      <!-- Game Over Banner -->
      <div v-else class="game-over-box">
        <strong>{{ state.winner === 0 ? '🎉 Victory! You reached the goal!' : '🏁 Match Complete' }}</strong>
        <button class="btn primary small full" type="button" @click="restartGame">
          Play Again ⚔️
        </button>
      </div>

      <!-- Toast Feedback -->
      <p v-if="toastMessage" class="alert warn toast-alert" role="alert">
        {{ toastMessage }}
      </p>
    </section>
  </div>
</template>
