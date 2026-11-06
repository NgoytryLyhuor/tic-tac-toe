<script setup>
import { computed, ref } from 'vue'
import { t } from '../lib/i18n.js'

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
  if (aiDifficulty.value === 'easy') return t('diff_help')
  if (aiDifficulty.value === 'medium') return t('diff_help')
  return 'Master bot • Unbeatable Minimax 🧠'
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
        <h1>{{ t('ttt_title') }}</h1>
        <p class="lede">{{ t('ttt_home_lede') }}</p>
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
        <span class="tab-label">{{ t('tab_vs_computer') }}</span>
      </button>
      <button
        type="button"
        class="mode-tab-btn"
        :class="{ active: activeMode === 'pvp' }"
        @click="activeMode = 'pvp'"
      >
        <span class="tab-icon">👥</span>
        <span class="tab-label">{{ t('tab_pvp') }}</span>
      </button>
    </div>

    <!-- Mode 1: Play with Computer (Solo) -->
    <div v-if="activeMode === 'ai'" class="ai-setup-pane">
      <div class="field">
        <span>{{ t('ai_diff_label') }}</span>
        <div class="diff-buttons">
          <button
            type="button"
            class="btn small"
            :class="aiDifficulty === 'easy' ? 'primary' : 'ghost'"
            @click="aiDifficulty = 'easy'"
          >
            {{ t('ttt_ai_easy') }}
          </button>
          <button
            type="button"
            class="btn small"
            :class="aiDifficulty === 'medium' ? 'primary' : 'ghost'"
            @click="aiDifficulty = 'medium'"
          >
            {{ t('ttt_ai_medium') }}
          </button>
          <button
            type="button"
            class="btn small"
            :class="aiDifficulty === 'master' ? 'primary' : 'ghost'"
            @click="aiDifficulty = 'master'"
          >
            {{ t('ttt_ai_master') }}
          </button>
        </div>
        <small class="diff-help">{{ diffDescription }}</small>
      </div>

      <label class="field">
        <span>{{ t('ttt_your_name') }}</span>
        <input
          :value="props.name"
          type="text"
          autocomplete="nickname"
          maxlength="20"
          :placeholder="t('ttt_name_placeholder')"
          @input="emit('update:name', $event.target.value)"
        />
      </label>

      <p v-if="props.error" class="alert" role="alert">{{ props.error }}</p>

      <button class="btn primary main-cta" type="button" @click="startAiMatch">
        <span>{{ t('ttt_btn_solo') }}</span>
        <span class="arrow-icon">→</span>
      </button>
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
          🌐 {{ t('subtab_online') }}
        </button>
        <button
          type="button"
          class="sub-seg-btn"
          :class="{ active: pvpType === 'pass' }"
          @click="pvpType = 'pass'"
        >
          📱 {{ t('subtab_pass') }}
        </button>
      </div>

      <!-- Online PvP -->
      <form v-if="pvpType === 'online'" class="form" @submit.prevent="emit('submit')">
        <div class="field">
          <div class="field-header">
            <span>{{ t('ttt_room_code') }}</span>
            <button
              class="random-btn"
              type="button"
              :title="t('ttt_random_code')"
              @click="emit('random-code')"
            >
              <span class="dice-icon">🎲</span> {{ t('ttt_random_code') }}
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
          <small>{{ t('ttt_share_hint') }}</small>
        </div>

        <label class="field">
          <span>{{ t('ttt_your_name') }}</span>
          <input
            :value="props.name"
            type="text"
            autocomplete="nickname"
            maxlength="20"
            :placeholder="t('ttt_name_placeholder')"
            @input="emit('update:name', $event.target.value)"
          />
        </label>

        <p v-if="props.error" class="alert" role="alert">{{ props.error }}</p>

        <button
          class="btn primary submit-btn"
          type="submit"
          :disabled="props.busy || !props.code"
        >
          <span v-if="props.busy" class="spinner small" aria-hidden="true"></span>
          <span>{{ t('ttt_btn_join') }}</span>
        </button>

        <div class="steps-row">
          <span class="step-chip">{{ t('step_1') }}</span>
          <span class="step-chip">{{ t('step_2') }}</span>
          <span class="step-chip">{{ t('step_3') }}</span>
        </div>
      </form>

      <!-- Pass & Play -->
      <div v-else class="pass-pane">
        <p class="pass-info">{{ t('pass_desc') }}</p>
        <button class="btn primary submit-btn" type="button" @click="startPassMatch">
          <span>{{ t('ttt_btn_pass') }}</span>
          <span class="arrow-icon">→</span>
        </button>
      </div>
    </div>
  </section>
</template>
