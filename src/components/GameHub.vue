<script setup>
import { t } from '../lib/i18n.js'

const emit = defineEmits(['select-game'])
</script>

<template>
  <div class="game-hub">
    <div class="hub-header">
      <p class="eyebrow">{{ t('hub_eyebrow') }}</p>
      <h1>{{ t('hub_title') }}</h1>
      <p class="lede">{{ t('hub_lede') }}</p>
    </div>

    <div class="hub-cards">
      <!-- Game 1: Barricade (Quoridor 9x9) -->
      <article class="hub-card featured" @click="emit('select-game', 'barricade')">
        <div class="hub-card-top">
          <div class="hub-badge-group">
            <span class="hub-icon-badge barricade-icon">🧱</span>
            <span class="hub-icon-badge runner-icon">🏃</span>
          </div>
          <span class="card-tag hot">{{ t('hub_tag_new_strategy') }}</span>
        </div>

        <h2>{{ t('hub_barricade_title') }}</h2>
        <p class="card-desc">
          {{ t('hub_barricade_desc') }}
        </p>

        <div class="feature-chips">
          <span class="chip-item">{{ t('chip_solo_ai') }}</span>
          <span class="chip-item">{{ t('chip_pvp') }}</span>
          <span class="chip-item">{{ t('chip_walls') }}</span>
        </div>

        <button class="btn primary play-hub-btn" type="button">
          <span>{{ t('btn_play_barricade') }}</span>
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
          <span class="card-tag">{{ t('hub_tag_classic_3x3') }}</span>
        </div>

        <h2>{{ t('hub_ttt_title') }}</h2>
        <p class="card-desc">
          {{ t('hub_ttt_desc') }}
        </p>

        <div class="feature-chips">
          <span class="chip-item">{{ t('chip_solo_ai') }}</span>
          <span class="chip-item">{{ t('chip_pvp') }}</span>
          <span class="chip-item">{{ t('chip_room_codes') }}</span>
        </div>

        <button class="btn ghost play-hub-btn" type="button">
          <span>{{ t('btn_play_ttt') }}</span>
          <span class="arrow">→</span>
        </button>
      </article>
    </div>
  </div>
</template>
