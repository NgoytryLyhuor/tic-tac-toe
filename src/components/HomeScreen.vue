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
    <div class="home-head">
      <div class="brand-hero">
        <span class="brand-badge x-badge">✕</span>
        <span class="brand-vs">VS</span>
        <span class="brand-badge o-badge">○</span>
      </div>
      <div>
        <h1>Tic Tac Toe</h1>
        <p class="lede">Fast 1v1 online. Share code to play.</p>
      </div>
    </div>

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
        <small>Enter any code to host or join an existing match.</small>
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
        <span>Enter or roll a code and tap <b>Start</b></span>
      </li>
      <li>
        <span class="step-num">2</span>
        <span>Share the code or invite link with a friend</span>
      </li>
      <li>
        <span class="step-num">3</span>
        <span>They join — play starts instantly</span>
      </li>
    </ol>
  </section>
</template>
