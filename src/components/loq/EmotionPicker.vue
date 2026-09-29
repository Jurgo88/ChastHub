<template>
  <div class="emotion-picker">
    <p class="emotion-picker__label">How are you feeling?</p>
    <div class="emotion-picker__row">
      <button
        v-for="e in EMOTIONS"
        :key="e.emoji"
        class="emotion-btn"
        :class="{ 'emotion-btn--active': modelValue === e.emoji }"
        :disabled="loading"
        type="button"
        :title="e.label"
        @click="pick(e.emoji)"
      >
        {{ e.emoji }}
      </button>
      <!-- TASK-070: client asked for a custom option instead of just an
           expanded preset list — type/paste any emoji. -->
      <input
        v-model="customInput"
        class="emotion-btn emotion-btn--custom"
        :class="{ 'emotion-btn--active': !!customInput && modelValue === customInput }"
        :disabled="loading"
        type="text"
        maxlength="8"
        placeholder="＋"
        title="Custom emoji"
        @keydown.enter="pickCustom"
        @blur="pickCustom"
      />
    </div>
    <p v-if="error" class="emotion-picker__error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string | null
  loqId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [emotion: string]
}>()

const { authFetch } = useAuthFetch()

const EMOTIONS = [
  { label: 'excited', emoji: '🤭' },
  { label: 'chill', emoji: '😅' },
  { label: 'weak', emoji: '😵' },
  { label: 'nervous', emoji: '🥺' },
  { label: 'hopeless', emoji: '😭' },
] as const

const loading = ref(false)
const error = ref('')
const customInput = ref('')

async function pick(emoji: string) {
  if (loading.value || emoji === props.modelValue) return
  loading.value = true
  error.value = ''
  try {
    await authFetch(`/api/loqs/${props.loqId}/emotion`, {
      method: 'POST',
      body: { emotion: emoji },
    })
    emit('update:modelValue', emoji)
    customInput.value = ''
  }
  catch {
    error.value = 'Could not save emotion.'
  }
  finally {
    loading.value = false
  }
}

function pickCustom() {
  const value = customInput.value.trim()
  if (value) pick(value)
}
</script>

<style scoped lang="scss">
.emotion-picker {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &__label {
    font-size: 0.8125rem;
    color: var(--color-muted);
    margin: 0;
  }

  &__row {
    display: flex;
    gap: 0.5rem;
  }

  &__error {
    font-size: 0.8rem;
    color: #dc2626;
    margin: 0;
  }
}

.emotion-btn {
  font-size: 1.625rem;
  background: none;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
  transition: border-color 0.15s, transform 0.1s;

  &:hover:not(:disabled) {
    transform: scale(1.15);
  }

  &--active {
    border-color: var(--color-accent);
    background: rgba(var(--color-accent-rgb, 0, 0, 0), 0.06);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--custom {
    width: 2.25rem;
    text-align: center;
    color: var(--color-text);
    font-size: 1.25rem;

    &::placeholder { color: var(--color-muted); font-size: 1rem; }
    &:hover:not(:disabled) { transform: none; border-color: var(--color-border); }
    &:focus { outline: none; border-color: var(--color-accent); transform: none; }
  }
}
</style>
