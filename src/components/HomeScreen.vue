<script setup>
const props = defineProps({
  code: { type: String, default: '' },
  name: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['update:code', 'update:name', 'submit', 'random-code'])

function onCode(event) {
  const clean = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  event.target.value = clean
  emit('update:code', clean)
}
</script>

<template>
  <section class="card home">
    <div class="brand-hero">
      <div class="brand-badge x-badge">
        <span>✕</span>
      </div>
      <div class="brand-vs">VS</div>
      <div class="brand-badge o-badge">
        <span>○</span>
      </div>
    </div>

    <h1>Tic Tac Toe</h1>
    <p class="lede">
      Fast 1v1 online multiplayer. Create a match, share the code with a friend, and play from anywhere on mobile or desktop.
    </p>

    <form class="form" @submit.prevent="emit('submit')">
      <div class="field">
        <div class="field-header">
          <span>Match code</span>
          <button
            class="random-btn"
            type="button"
            title="Generate random code"
            @click="emit('random-code')"
          >
            <span class="dice-icon">🎲</span> Random Code
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
            placeholder="e.g. PLAY7"
            @input="onCode"
          />
        </div>
        <small>Enter any code. If the match doesn't exist yet, you host it. If it does, you join it.</small>
      </div>

      <label class="field">
        <span>Your nickname <em>(optional)</em></span>
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
        <span>{{ props.busy ? 'Connecting…' : 'Start / Join Match' }}</span>
        <span class="arrow-icon">→</span>
      </button>
    </form>

    <div class="rules-highlight">
      <div class="rule-chip">
        <span class="rule-icon">⚖️</span>
        <span>Fair alternating turns on every rematch</span>
      </div>
    </div>

    <ol class="steps">
      <li>
        <span class="step-num">1</span>
        <span>Type or roll a code and tap <b>Start</b></span>
      </li>
      <li>
        <span class="step-num">2</span>
        <span>Send the code or 1-tap invite link to your friend</span>
      </li>
      <li>
        <span class="step-num">3</span>
        <span>They open the link — game begins instantly</span>
      </li>
    </ol>
  </section>
</template>
