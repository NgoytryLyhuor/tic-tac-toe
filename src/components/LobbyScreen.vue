<script setup>
import { computed } from 'vue'
import { t } from '../lib/i18n.js'

const props = defineProps({
  room: { type: Object, required: true },
  inviteUrl: { type: String, default: '' },
  copied: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  connection: { type: String, default: 'idle' },
})

const emit = defineEmits(['copy-code', 'copy-link', 'share', 'leave'])

const myName = computed(() => props.room.players?.[props.room.you]?.name || t('you_label'))

const waitingLabel = computed(() => {
  if (props.connection === 'reconnecting' || props.connection === 'offline') {
    return 'Reconnecting…'
  }
  return t('ttt_waiting_status')
})
</script>

<template>
  <section class="card lobby">
    <div class="lobby-header">
      <div class="status-badge pulse">
        <span class="pulse-dot"></span>
        <span>{{ t('turn_active') }}</span>
      </div>
      <p class="eyebrow">{{ t('ttt_room_code') }}</p>
      <h1>{{ t('lobby_title') }}</h1>
    </div>

    <!-- Match Code Box -->
    <div class="code-box" role="region" aria-label="Match code">
      <div class="code-header">
        <span>{{ t('ttt_room_code') }}</span>
        <span class="code-hint">Tap to copy</span>
      </div>
      <button class="code-display interactive" type="button" title="Tap to copy" @click="emit('copy-code')">
        <span v-for="(char, index) in props.room.code" :key="index" class="code-char">{{ char }}</span>
      </button>
      <div v-if="props.copied === 'code'" class="copied-banner">
        {{ t('btn_copied_code') }}
      </div>
    </div>

    <div class="actions share-actions">
      <button class="btn primary share-btn" type="button" @click="emit('share')">
        <span class="icon">🔗</span>
        <span>{{ t('btn_share_link') }}</span>
      </button>
      <button class="btn ghost copy-btn" type="button" @click="emit('copy-code')">
        <span class="icon">📋</span>
        <span>{{ props.copied === 'code' ? t('btn_copied_code') : t('btn_copy_code') }}</span>
      </button>
    </div>

    <!-- Matchup Preview -->
    <div class="matchup-preview">
      <div class="player-slot seated">
        <div class="slot-avatar x-avatar">✕</div>
        <div class="slot-info">
          <strong>{{ myName }}</strong>
          <span class="slot-tag">Ready</span>
        </div>
      </div>

      <div class="matchup-vs">VS</div>

      <div class="player-slot waiting">
        <div class="slot-avatar o-avatar waiting-radar">
          <span class="radar-ping"></span>
          <span>○</span>
        </div>
        <div class="slot-info">
          <strong>{{ t('waiting') }}…</strong>
          <span class="slot-tag waiting-text">Open</span>
        </div>
      </div>
    </div>

    <div class="waiting-indicator">
      <span class="spinner" aria-hidden="true"></span>
      <span>{{ waitingLabel }}</span>
    </div>

    <div class="lobby-footer">
      <button class="btn link danger small" type="button" :disabled="props.busy" @click="emit('leave')">
        {{ t('btn_leave') }}
      </button>
    </div>
  </section>
</template>
