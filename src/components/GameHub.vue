<script setup>
const emit = defineEmits(['select-game'])
</script>

<template>
  <div class="game-hub">
    <div class="hub-header">
      <p class="eyebrow">Play Online & Local</p>
      <h1>Choose a Game</h1>
      <p class="lede">Pick a game to start playing on mobile, desktop, or Telegram.</p>
    </div>

    <div class="hub-cards">
      <!-- Game 1: Barricade (Quoridor 9x9) -->
      <article class="hub-card featured" @click="emit('select-game', 'barricade')">
        <div class="hub-card-top">
          <div class="hub-badge-group">
            <span class="hub-icon-badge barricade-icon">🧱</span>
            <span class="hub-icon-badge runner-icon">🏃</span>
          </div>
          <span class="card-tag hot">NEW • STRATEGY</span>
        </div>

        <h2>Barricade (Quoridor)</h2>
        <p class="card-desc">
          Race across the 9×9 grid to reach the opposite side. Place walls to trap and delay your rival! Inspired by <b>barricade.gg</b>.
        </p>

        <div class="feature-chips">
          <span class="chip-item">🤖 Solo vs AI</span>
          <span class="chip-item">👥 Pass & Play</span>
          <span class="chip-item">🌐 Online 1v1</span>
        </div>

        <button class="btn primary play-hub-btn" type="button">
          <span>Play Barricade</span>
          <span class="arrow">→</span>
        </button>
      </article>

      <!-- Game 2: Tic Tac Toe (3x3 Online) -->
      <article class="hub-card" @click="emit('select-game', 'ttt')">
        <div class="hub-card-top">
          <div class="hub-badge-group">
            <span class="hub-icon-badge x-mini">✕</span>
            <span class="hub-icon-badge o-mini">○</span>
          </div>
          <span class="card-tag">CLASSIC • 1V1</span>
        </div>

        <h2>Tic Tac Toe</h2>
        <p class="card-desc">
          Fast-paced 3×3 multiplayer with fair alternating turns each rematch and live match scores.
        </p>

        <div class="feature-chips">
          <span class="chip-item">⚖️ Fair Alternating</span>
          <span class="chip-item">🏆 Scoreboard</span>
          <span class="chip-item">🔗 Room Codes</span>
        </div>

        <button class="btn ghost play-hub-btn" type="button">
          <span>Play Tic Tac Toe</span>
          <span class="arrow">→</span>
        </button>
      </article>
    </div>
  </div>
</template>
