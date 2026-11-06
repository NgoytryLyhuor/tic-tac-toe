<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  code: { type: String, default: '' },
  name: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits([
  'update:code',
  'update:name',
  'submit',
  'random-code',
  'start-ai',
  'start-pass',
])

const activeMode = ref('ai') // 'ai' | 'pvp'
const aiDifficulty = ref('medium') // 'easy' | 'medium' | 'master'
const pvpType = ref('online') // 'online' | 'pass'

function onCode(event) {
  const clean = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  event.target.value = clean
  emit('update:code', clean)
}

function startAiMatch() {
  emit('start-ai', aiDifficulty.value)
}

function startPassMatch() {
  emit('start-pass')
}

const diffDescription = computed(() => {
  if (aiDifficulty.value === 'easy') return 'Casual & relaxed bot • Great for quick fun'
  if (aiDifficulty.value === 'medium') return 'Smart bot • Blocks traps & seizes winning moves'
  return 'Master bot • Unbeatable Minimax algorithm 🧠'
})
</script>

<template>
  <section class="card home">
    <div class="home-head">
      <div class="brand-hero">
        <span class="brand-badge x-badge">✕</span>
        <span class="brand-vs">VS</span>
        <span class="brand-badge o-badge">○</span>
      </div>
      <div>
        <h1>Tic Tac Toe</h1>
        <p class="lede">Classic 3×3 with fair turns. Play solo or PvP.</p>
      </div>
    </div>

    <!-- Top Mode Switcher: Solo vs 2 Players -->
    <div class="mode-tabs">
      <button
        type="button"
        class="mode-tab-btn"
        :class="{ active: activeMode === 'ai' }"
        @click="activeMode = 'ai'"
      >
        <span class="tab-icon">🤖</span>
        <span class="tab-label">vs Computer</span>
      </button>
      <button
        type="button"
        class="mode-tab-btn"
        :class="{ active: activeMode === 'pvp' }"
        @click="activeMode = 'pvp'"
      >
        <span class="tab-icon">👥</span>
        <span class="tab-label">2 Players (PvP)</span>
      </button>
    </div>

    <!-- Mode 1: Play with Computer (Solo / Alone) -->
    <div v-if="activeMode === 'ai'" class="ai-setup-pane">
      <div class="field">
        <span>AI Difficulty</span>
        <div class="diff-buttons">
          <button
            type="button"
            class="btn small"
            :class="aiDifficulty === 'easy' ? 'primary' : 'ghost'"
            @click="aiDifficulty = 'easy'"
          >
            Easy
          </button>
          <button
            type="button"
            class="btn small"
            :class="aiDifficulty === 'medium' ? 'primary' : 'ghost'"
            @click="aiDifficulty = 'medium'"
          >
            Medium ⭐
          </button>
          <button
            type="button"
            class="btn small"
            :class="aiDifficulty === 'master' ? 'primary' : 'ghost'"
            @click="aiDifficulty = 'master'"
          >
            Master 🧠
          </button>
        </div>
        <small class="diff-help">{{ diffDescription }}</small>
      </div>

      <label class="field">
        <span>Your Nickname <em>(optional)</em></span>
        <input
          :value="props.name"
          type="text"
          autocomplete="nickname"
          maxlength="20"
          placeholder="You (Player X)"
          @input="emit('update:name', $event.target.value)"
        />
      </label>

      <p v-if="props.error" class="alert" role="alert">{{ props.error }}</p>

      <button class="btn primary main-cta" type="button" @click="startAiMatch">
        <span>Play Solo vs AI</span>
        <span class="arrow-icon">→</span>
      </button>

      <div class="rules-highlight">
        <div class="rule-chip">
          <span class="rule-icon">⚖️</span>
          <span>Fair alternating turns on every rematch</span>
        </div>
      </div>
    </div>

    <!-- Mode 2: Play with 2 People (PvP) -->
    <div v-else class="pvp-setup-pane">
      <div class="sub-segmented">
        <button
          type="button"
          class="sub-seg-btn"
          :class="{ active: pvpType === 'online' }"
          @click="pvpType = 'online'"
        >
          🌐 Online (Room Code)
        </button>
        <button
          type="button"
          class="sub-seg-btn"
          :class="{ active: pvpType === 'pass' }"
          @click="pvpType = 'pass'"
        >
          📱 Pass & Play (Local)
        </button>
      </div>

      <!-- Online PvP -->
      <form v-if="pvpType === 'online'" class="form" @submit.prevent="emit('submit')">
        <div class="field">
          <div class="field-header">
            <span>Match code</span>
            <button
              class="random-btn"
              type="button"
              title="Generate random code"
              @click="emit('random-code')"
            >
              <span class="dice-icon">🎲</span> Random
            </button>
          </div>
          <div class="input-wrap">
            <input
              :value="props.code"
              class="code-input"
              type="text"
              inputmode="text"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              maxlength="8"
              placeholder="CODE1"
              @input="onCode"
            />
          </div>
          <small>Share this code with your friend to connect.</small>
        </div>

        <label class="field">
          <span>Nickname <em>(optional)</em></span>
          <input
            :value="props.name"
            type="text"
            autocomplete="nickname"
            maxlength="20"
            placeholder="Player 1"
            @input="emit('update:name', $event.target.value)"
          />
        </label>

        <p v-if="props.error" class="alert" role="alert">{{ props.error }}</p>

        <button class="btn primary main-cta" type="submit" :disabled="props.busy">
          <span v-if="props.busy" class="spinner" aria-hidden="true"></span>
          <span>{{ props.busy ? 'Connecting…' : 'Start / Join Online Match' }}</span>
          <span class="arrow-icon">→</span>
        </button>

        <ol class="steps">
          <li>
            <span class="step-num">1</span>
            <span>Enter or roll a code and tap <b>Start</b></span>
          </li>
          <li>
            <span class="step-num">2</span>
            <span>Share code or invite link with a friend</span>
          </li>
          <li>
            <span class="step-num">3</span>
            <span>They join — play starts instantly</span>
          </li>
        </ol>
      </form>

      <!-- Local Pass & Play -->
      <div v-else class="pass-setup-pane">
        <label class="field">
          <span>Your Nickname <em>(optional)</em></span>
          <input
            :value="props.name"
            type="text"
            autocomplete="nickname"
            maxlength="20"
            placeholder="Player 1"
            @input="emit('update:name', $event.target.value)"
          />
        </label>

        <p class="pass-desc">
          Take turns playing <b>✕</b> and <b>○</b> on this phone screen. Zero internet or setup required!
        </p>

        <button class="btn primary main-cta" type="button" @click="startPassMatch">
          <span>Start 2-Player Local Match</span>
          <span class="arrow-icon">→</span>
        </button>

        <div class="rules-highlight">
          <div class="rule-chip">
            <span class="rule-icon">⚖️</span>
            <span>Alternating turns on each rematch</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
