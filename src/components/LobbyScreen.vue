<script setup>
import { computed } from 'vue'

const props = defineProps({
  room: { type: Object, required: true },
  inviteUrl: { type: String, default: '' },
  copied: { type: String, default: '' },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['copy-code', 'copy-link', 'leave'])

const myName = computed(() => props.room.players?.[props.room.you]?.name || 'You')
</script>

<template>
  <section class="card lobby">
    <p class="eyebrow">Match created</p>
    <h1>Waiting for a friend</h1>

    <div class="code-display" aria-label="Match code">
      <span v-for="(char, index) in props.room.code" :key="index">{{ char }}</span>
    </div>

    <p class="lede">
      Share this code. Your friend opens the site and enters the same code to join your match.
    </p>

    <div class="actions">
      <button class="btn ghost" type="button" @click="emit('copy-code')">
        {{ props.copied === 'code' ? 'Code copied ✓' : 'Copy code' }}
      </button>
      <button class="btn ghost" type="button" @click="emit('copy-link')">
        {{ props.copied === 'link' ? 'Link copied ✓' : 'Copy invite link' }}
      </button>
    </div>

    <div class="players">
      <div class="player active">
        <span class="symbol x">X</span>
        <div>
          <strong>{{ myName }}</strong>
          <small>You</small>
        </div>
      </div>
      <div class="player waiting">
        <span class="symbol o">O</span>
        <div>
          <strong>Waiting…</strong>
          <small>Share the code to invite</small>
        </div>
      </div>
    </div>

    <div class="waiting-row">
      <span class="spinner" aria-hidden="true"></span>
      <span>Looking for your opponent…</span>
    </div>

    <button class="btn link danger" type="button" :disabled="props.busy" @click="emit('leave')">
      Leave match
    </button>
  </section>
</template>
