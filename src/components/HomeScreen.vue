<script setup>
const props = defineProps({
  code: { type: String, default: '' },
  name: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
  warning: { type: String, default: '' },
  warningUrl: { type: String, default: '' },
})

const emit = defineEmits(['update:code', 'update:name', 'submit'])

function onCode(event) {
  const clean = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  event.target.value = clean
  emit('update:code', clean)
}
</script>

<template>
  <section class="card home">
    <div class="brand">
      <span class="brand-x">X</span>
      <span class="brand-o">O</span>
    </div>

    <h1>Tic Tac Toe</h1>
    <p class="lede">
      Create a match, share the code with a friend, and play together from anywhere.
    </p>

    <form class="form" @submit.prevent="emit('submit')">
      <label class="field">
        <span>Match code</span>
        <input
          :value="props.code"
          class="code-input"
          type="text"
          inputmode="text"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          maxlength="8"
          placeholder="1234"
          @input="onCode"
        />
        <small>Use the same code as your friend. A new match is created if it doesn't exist yet.</small>
      </label>

      <label class="field">
        <span>Your name <em>(optional)</em></span>
        <input
          :value="props.name"
          type="text"
          autocomplete="nickname"
          maxlength="24"
          placeholder="Player"
          @input="emit('update:name', $event.target.value)"
        />
      </label>

      <p v-if="props.error" class="alert" role="alert">{{ props.error }}</p>

      <button class="btn primary" type="submit" :disabled="props.busy">
        <span v-if="props.busy" class="spinner" aria-hidden="true"></span>
        {{ props.busy ? 'Joining…' : 'Create / Join match' }}
      </button>
    </form>

    <p v-if="props.warning" class="alert warn">
      {{ props.warning }}
      <a v-if="props.warningUrl" :href="props.warningUrl" target="_blank" rel="noreferrer">
        Open project settings →
      </a>
    </p>

    <ol class="steps">
      <li><b>1</b> Enter a code and tap join.</li>
      <li><b>2</b> Send the code or invite link to your friend.</li>
      <li><b>3</b> They enter the same code — game on.</li>
    </ol>
  </section>
</template>
