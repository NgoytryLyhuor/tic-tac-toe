<script setup>
const emit = defineEmits(['select-game'])
</script>

<template>
  <div class="game-hub">
    <div class="hub-header">
      <p class="eyebrow">Online & Offline Arena</p>
      <h1>Choose a Game</h1>
      <p class="lede">Play solo against computer or 2 players with friends.</p>
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
          Race across the 9×9 grid to reach the goal. Place 10 wooden barricades to block rivals! Inspired by <b>barricade.gg</b>.
        </p>

        <div class="feature-chips">
          <span class="chip-item">🤖 Solo vs AI</span>
          <span class="chip-item">👥 2 Players (PvP)</span>
          <span class="chip-item">🧱 10 Walls</span>
        </div>

        <button class="btn primary play-hub-btn" type="button">
          <span>Play Barricade</span>
          <span class="arrow">→</span>
        </button>
      </article>

      <!-- Game 2: Tic Tac Toe (3x3) -->
      <article class="hub-card" @click="emit('select-game', 'ttt')">
        <div class="hub-card-top">
          <div class="hub-badge-group">
            <span class="hub-icon-badge x-mini">✕</span>
            <span class="hub-icon-badge o-mini">○</span>
          </div>
          <span class="card-tag">CLASSIC • 3X3</span>
        </div>

        <h2>Tic Tac Toe</h2>
        <p class="card-desc">
          Play solo against smart Minimax AI, or 1v1 with friends via room codes & pass-and-play.
        </p>

        <div class="feature-chips">
          <span class="chip-item">🤖 Solo vs AI</span>
          <span class="chip-item">👥 2 Players (PvP)</span>
          <span class="chip-item">⚖️ Fair Alternating</span>
        </div>

        <button class="btn ghost play-hub-btn" type="button">
          <span>Play Tic Tac Toe</span>
          <span class="arrow">→</span>
        </button>
      </article>
    </div>
  </div>
</template>
