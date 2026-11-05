<script setup>
import { computed } from 'vue'

const props = defineProps({
  room: { type: Object, required: true },
  inviteUrl: { type: String, default: '' },
  copied: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  connection: { type: String, default: 'idle' },
})

const emit = defineEmits(['move', 'rematch', 'leave', 'copy-link', 'share'])

const you = computed(() => props.room.you)
const opponent = computed(() => (you.value === 'X' ? 'O' : 'X'))
const myName = computed(() => props.room.players?.[you.value]?.name || 'You')
const opponentName = computed(() => props.room.players?.[opponent.value]?.name || 'Opponent')
const isHost = computed(() => you.value === 'X')

const round = computed(() => props.room.round || 1)
const starter = computed(() => props.room.starter || 'X')
const scores = computed(() => props.room.scores || { X: 0, O: 0, draws: 0 })

const isPlaying = computed(() => props.room.status === 'playing')
const isFinished = computed(() => props.room.status === 'finished')
const isMyTurn = computed(() => isPlaying.value && props.room.turn === you.value)
const winningLine = computed(() => props.room.result?.line || [])

const connectionLost = computed(
  () => props.connection === 'reconnecting' || props.connection === 'offline',
)

const nextStarter = computed(() => (starter.value === 'X' ? 'O' : 'X'))
const nextStarterName = computed(() => {
  if (nextStarter.value === you.value) return 'You'
  return opponentName.value
})

const starterLabel = computed(() => {
  if (starter.value === you.value) return 'You started first'
  return `${opponentName.value} started first`
})

const statusBanner = computed(() => {
  if (isFinished.value) {
    const winner = props.room.result?.winner
    if (winner === 'draw') return { text: "It's a draw! Well played.", type: 'draw' }
    if (winner === you.value) return { text: 'Victory! You won this round! 🎉', type: 'win' }
    return { text: `${opponentName.value} won this round.`, type: 'loss' }
  }
  if (!isPlaying.value) {
    return { text: 'Waiting for match to resume…', type: 'neutral' }
  }
  if (isHost.value && props.room.opponentOnline === false) {
    return { text: 'Opponent disconnected. Waiting…', type: 'warn' }
  }
  if (connectionLost.value) {
    return { text: 'Reconnecting to relay…', type: 'warn' }
  }
  if (isMyTurn.value) {
    return { text: 'Your Turn — Tap open square', type: 'turn-mine' }
  }
  return { text: `Waiting for ${opponentName.value}…`, type: 'turn-theirs' }
})

const rematchVoted = computed(() => Boolean(props.room.rematch?.[you.value]))
const opponentVoted = computed(() => Boolean(props.room.rematch?.[opponent.value]))

// Strike-through line coordinates
const strikeLine = computed(() => {
  const line = winningLine.value
  if (!line || line.length !== 3) return null

  const key = line.slice().sort().join(',')
  // Horizontal
  if (key === '0,1,2') return { x1: 6, y1: 16.66, x2: 94, y2: 16.66, type: 'h' }
  if (key === '3,4,5') return { x1: 6, y1: 50, x2: 94, y2: 50, type: 'h' }
  if (key === '6,7,8') return { x1: 6, y1: 83.33, x2: 94, y2: 83.33, type: 'h' }
  // Vertical
  if (key === '0,3,6') return { x1: 16.66, y1: 6, x2: 16.66, y2: 94, type: 'v' }
  if (key === '1,4,7') return { x1: 50, y1: 6, x2: 50, y2: 94, type: 'v' }
  if (key === '2,5,8') return { x1: 83.33, y1: 6, x2: 83.33, y2: 94, type: 'v' }
  // Diagonal
  if (key === '0,4,8') return { x1: 10, y1: 10, x2: 90, y2: 90, type: 'd1' }
  if (key === '2,4,6') return { x1: 90, y1: 10, x2: 10, y2: 90, type: 'd2' }

  return null
})

function cellClass(index) {
  const val = props.room.board[index]
  return {
    'cell-x': val === 'X',
    'cell-o': val === 'O',
    win: winningLine.value.includes(index),
    playable: isMyTurn.value && val === null,
  }
}
</script>

<template>
  <section class="card game">
    <!-- Header: Code Chip, Share & Leave -->
    <header class="game-top">
      <button
        class="code-chip"
        type="button"
        title="Copy or share match code"
        @click="emit('copy-link')"
      >
        <span class="chip-label">Room</span>
        <strong class="chip-val">{{ props.room.code }}</strong>
        <span v-if="props.copied === 'link'" class="chip-flash">✓</span>
      </button>

      <div class="top-nav-right">
        <button
          class="btn ghost small share-quick"
          type="button"
          title="Share invite link"
          @click="emit('share')"
        >
          Share 🔗
        </button>
        <button
          class="btn link danger small"
          type="button"
          :disabled="props.busy"
          @click="emit('leave')"
        >
          Leave
        </button>
      </div>
    </header>

    <p v-if="connectionLost" class="alert warn" role="alert">
      Connection lost — reconnecting…
    </p>

    <!-- Scoreboard & Match Info -->
    <div class="match-meta">
      <span class="round-badge">Round {{ round }}</span>
      <span class="starter-tag">• {{ starterLabel }}</span>
    </div>

    <div class="scoreboard">
      <!-- Player X -->
      <div
        class="player-card"
        :class="{
          active: isPlaying && props.room.turn === 'X',
          you: you === 'X',
          winner: props.room.result?.winner === 'X',
        }"
      >
        <div class="player-top">
          <span class="symbol-badge x">✕</span>
          <span class="player-role">{{ you === 'X' ? 'You' : 'Opponent' }}</span>
        </div>
        <strong class="player-name">{{ you === 'X' ? myName : opponentName }}</strong>
        <div class="score-display">
          <span class="score-val">{{ scores.X }}</span>
          <span class="score-label">pts</span>
        </div>
        <span v-if="isPlaying && props.room.turn === 'X'" class="turn-dot">Turn</span>
      </div>

      <!-- Draws / VS Column -->
      <div class="vs-column">
        <span class="vs-text">VS</span>
        <div class="draw-pill" title="Draws">
          <span class="draw-label">Ties</span>
          <span class="draw-count">{{ scores.draws }}</span>
        </div>
      </div>

      <!-- Player O -->
      <div
        class="player-card"
        :class="{
          active: isPlaying && props.room.turn === 'O',
          you: you === 'O',
          winner: props.room.result?.winner === 'O',
        }"
      >
        <div class="player-top">
          <span class="symbol-badge o">○</span>
          <span class="player-role">{{ you === 'O' ? 'You' : 'Opponent' }}</span>
        </div>
        <strong class="player-name">{{ you === 'O' ? myName : opponentName }}</strong>
        <div class="score-display">
          <span class="score-val">{{ scores.O }}</span>
          <span class="score-label">pts</span>
        </div>
        <span v-if="isPlaying && props.room.turn === 'O'" class="turn-dot">Turn</span>
      </div>
    </div>

    <!-- Dynamic Turn / Status Banner -->
    <div class="turn-banner" :class="statusBanner.type">
      <span v-if="statusBanner.type === 'turn-mine'" class="pulse-indicator"></span>
      <span class="banner-text">{{ statusBanner.text }}</span>
    </div>

    <!-- 3x3 Game Board with SVG Strike Line -->
    <div class="board-wrapper">
      <div class="board" role="grid" aria-label="Tic tac toe board">
        <button
          v-for="(value, index) in props.room.board"
          :key="index"
          type="button"
          class="cell"
          :class="cellClass(index)"
          :disabled="props.busy || !isMyTurn || value !== null"
          :aria-label="`Square ${index + 1}${value ? ', ' + value : ', empty'}`"
          @click="emit('move', index)"
        >
          <!-- SVG Cross Mark -->
          <svg
            v-if="value === 'X'"
            class="mark-svg x-svg"
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            stroke-width="6.5"
            stroke-linecap="round"
          >
            <line x1="12" y1="12" x2="36" y2="36" />
            <line x1="36" y1="12" x2="12" y2="36" />
          </svg>

          <!-- SVG Circle Mark -->
          <svg
            v-else-if="value === 'O'"
            class="mark-svg o-svg"
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            stroke-width="6"
          >
            <circle cx="24" cy="24" r="14" />
          </svg>
        </button>
      </div>

      <!-- Winning Strike-through SVG line -->
      <svg
        v-if="strikeLine"
        class="strike-overlay"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <line
          :x1="strikeLine.x1"
          :y1="strikeLine.y1"
          :x2="strikeLine.x2"
          :y2="strikeLine.y2"
          class="strike-path"
        />
      </svg>
    </div>

    <!-- Round Finished Modal / Action Card -->
    <div v-if="isFinished" class="result-box" :class="{ win: props.room.result?.winner === you }">
      <div class="result-info">
        <strong v-if="props.room.result?.winner === you" class="result-title win-text">
          🎉 Victory!
        </strong>
        <strong v-else-if="props.room.result?.winner === 'draw'" class="result-title draw-text">
          🤝 It's a Tie!
        </strong>
        <strong v-else class="result-title loss-text">
          Round to {{ opponentName }}
        </strong>

        <div class="next-round-info">
          <span class="fair-icon">⚖️</span>
          <span>Next: <b>{{ nextStarterName }}</b> ({{ nextStarter }}) starts first</span>
        </div>
      </div>

      <div class="rematch-actions">
        <button
          v-if="!rematchVoted"
          class="btn primary rematch-btn"
          type="button"
          :disabled="props.busy"
          @click="emit('rematch')"
        >
          <span v-if="opponentVoted">Accept Rematch ⚔️</span>
          <span v-else>Play Again ⚔️</span>
        </button>

        <div v-else class="waiting-rematch">
          <span class="spinner" aria-hidden="true"></span>
          <span>{{ opponentVoted ? 'Starting next round…' : 'Waiting for opponent…' }}</span>
        </div>
      </div>
    </div>

    <!-- Quick Footer Invite Link -->
    <p class="invite-footer">
      Invite friend:
      <button class="inline-link" type="button" @click="emit('share')">
        {{ props.copied === 'link' ? 'Copied ✓' : 'Share link 🔗' }}
      </button>
    </p>
  </section>
</template>
