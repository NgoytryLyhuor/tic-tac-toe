<script setup>
import { computed } from 'vue'

const props = defineProps({
  room: { type: Object, required: true },
  inviteUrl: { type: String, default: '' },
  copied: { type: String, default: '' },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['move', 'rematch', 'leave', 'copy-link'])

const you = computed(() => props.room.you)
const opponent = computed(() => (you.value === 'X' ? 'O' : 'X'))
const myName = computed(() => props.room.players?.[you.value]?.name || 'You')
const opponentName = computed(() => props.room.players?.[opponent.value]?.name || 'Opponent')

const isPlaying = computed(() => props.room.status === 'playing')
const isFinished = computed(() => props.room.status === 'finished')
const isMyTurn = computed(() => isPlaying.value && props.room.turn === you.value)
const winningLine = computed(() => props.room.result?.line || [])

const statusText = computed(() => {
  if (isFinished.value) return 'Round finished'
  if (!isPlaying.value) return 'Waiting for opponent…'
  return isMyTurn.value ? 'Your turn' : `${opponentName.value}'s turn`
})

const resultTitle = computed(() => {
  const winner = props.room.result?.winner
  if (!winner) return ''
  if (winner === 'draw') return "It's a draw"
  return winner === you.value ? 'You win! 🎉' : 'You lose'
})

const rematchVoted = computed(() => Boolean(props.room.rematch?.[you.value]))
const opponentVoted = computed(() => Boolean(props.room.rematch?.[opponent.value]))

function cellClass(index) {
  return {
    'cell-x': props.room.board[index] === 'X',
    'cell-o': props.room.board[index] === 'O',
    win: winningLine.value.includes(index),
    playable: isMyTurn.value && props.room.board[index] === null,
  }
}
</script>

<template>
  <section class="card game">
    <header class="game-top">
      <button class="chip" type="button" title="Copy invite link" @click="emit('copy-link')">
        <span>Code</span>
        <strong>{{ props.room.code }}</strong>
        <span v-if="props.copied === 'link'" class="chip-flash">copied</span>
      </button>
      <button class="btn link danger small" type="button" :disabled="props.busy" @click="emit('leave')">
        Leave
      </button>
    </header>

    <div class="players">
      <div class="player" :class="{ active: isPlaying && props.room.turn === 'X', you: you === 'X' }">
        <span class="symbol x">X</span>
        <div>
          <strong>{{ you === 'X' ? myName : opponentName }}</strong>
          <small>{{ you === 'X' ? 'You' : 'Opponent' }}</small>
        </div>
      </div>
      <div class="player" :class="{ active: isPlaying && props.room.turn === 'O', you: you === 'O' }">
        <span class="symbol o">O</span>
        <div>
          <strong>{{ you === 'O' ? myName : opponentName }}</strong>
          <small>{{ you === 'O' ? 'You' : 'Opponent' }}</small>
        </div>
      </div>
    </div>

    <p class="status" :class="{ mine: isMyTurn }">{{ statusText }}</p>

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
        <span v-if="value" class="mark">{{ value }}</span>
      </button>
    </div>

    <div v-if="isFinished" class="result" :class="{ win: props.room.result?.winner === you }">
      <strong>{{ resultTitle }}</strong>
      <span v-if="props.room.result?.winner === 'draw'">Nobody wins this time.</span>
      <span v-else-if="props.room.result?.winner === you">Nice one. Ready for another round?</span>
      <span v-else>{{ opponentName }} takes this round.</span>

      <div class="actions">
        <button
          v-if="!rematchVoted"
          class="btn primary"
          type="button"
          :disabled="props.busy"
          @click="emit('rematch')"
        >
          Play again
        </button>
        <p v-else class="waiting-row">
          <span class="spinner" aria-hidden="true"></span>
          <span>{{ opponentVoted ? 'Starting…' : 'Waiting for opponent to accept…' }}</span>
        </p>
      </div>
    </div>

    <p class="hint">
      Share this link so your friend can jump straight into this match:
      <button class="inline-link" type="button" @click="emit('copy-link')">
        {{ props.copied === 'link' ? 'Copied ✓' : 'Copy invite link' }}
      </button>
    </p>
  </section>
</template>
