<template>
  <div class="emotion-picker">
    <p class="emotion-picker__label">How are you feeling?</p>
    <div class="emotion-picker__row">
      <button
        v-for="e in EMOTIONS"
        :key="e"
        class="emotion-btn"
        :class="{ 'emotion-btn--active': modelValue === e }"
        :disabled="loading"
        type="button"
        :title="e"
        @click="pick(e)"
      >
        {{ e }}
      </button>
    </div>
    <p v-if="error" class="emotion-picker__error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string | null
  relationshipId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [emotion: string]
}>()

const { authFetch } = useAuthFetch()

const EMOTIONS = ['😊', '😅', '😤', '🥺', '😈'] as const

const loading = ref(false)
const error = ref('')

async function pick(emotion: string) {
  if (loading.value || emotion === props.modelValue) return
  loading.value = true
  error.value = ''
  try {
    await authFetch(`/api/locks/${props.relationshipId}/emotion`, {
      method: 'POST',
      body: { emotion },
    })
    emit('update:modelValue', emotion)
  }
  catch {
    error.value = 'Could not save emotion.'
  }
  finally {
    loading.value = false
  }
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
}
</style>
