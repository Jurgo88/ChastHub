<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2>Report user</h2>
      <p class="modal-note">Reports are reviewed by our admin team.</p>

      <div class="field">
        <label class="field-label">Reason</label>
        <select v-model="reason" class="field-input">
          <option value="" disabled>Select a reason…</option>
          <option v-for="r in REASONS" :key="r" :value="r">{{ r }}</option>
        </select>
      </div>

      <div class="field">
        <label class="field-label">Description (optional)</label>
        <textarea
          v-model="description"
          class="field-input"
          rows="3"
          maxlength="500"
          placeholder="Provide more details…"
        />
      </div>

      <p v-if="error" class="error-text">{{ error }}</p>
      <p v-if="success" class="success-text">Report submitted. Thank you.</p>

      <div class="modal-actions">
        <button class="btn btn-outline" @click="$emit('close')">Cancel</button>
        <button class="btn btn-danger" :disabled="submitting || !!success" @click="submit">
          {{ submitting ? 'Submitting…' : 'Submit report' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ reportedUserId: string; conversationId?: string; loungeMessageId?: string }>()
const emit = defineEmits<{ close: [] }>()

const { authFetch } = useAuthFetch()

const REASONS = ['Abusive behavior', 'Harassment', 'Inappropriate content', 'Other']

const reason = ref('')
const description = ref('')
const submitting = ref(false)
const error = ref('')
const success = ref(false)

async function submit() {
  if (!reason.value) { error.value = 'Please select a reason.'; return }
  submitting.value = true
  error.value = ''
  try {
    await authFetch('/api/reports', {
      method: 'POST',
      body: {
        reported_user_id: props.reportedUserId,
        reason: reason.value,
        description: description.value || undefined,
        conversation_id: props.conversationId,
        lounge_message_id: props.loungeMessageId,
      },
    })
    success.value = true
    setTimeout(() => emit('close'), 2000)
  }
  catch {
    error.value = 'Failed to submit report. Please try again.'
  }
  finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  padding: 2rem;
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  h2 { font-size: 1.25rem; font-weight: 700; margin: 0; color: var(--color-text); }
}

.modal-note {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  margin: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.field-input {
  padding: 0.5rem 0.75rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  color: var(--color-text);
  font-size: 0.9rem;
  outline: none;
  resize: vertical;

  &:focus { border-color: var(--color-accent); }
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1.25rem;
  border-radius: 0.375rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;

  &:disabled { opacity: 0.5; cursor: not-allowed; }

  &-outline {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text);
    &:hover:not(:disabled) { background: var(--color-border); }
  }

  &-danger {
    background: var(--color-danger);
    color: #fff;
    &:hover:not(:disabled) { opacity: 0.9; }
  }
}

.error-text { color: var(--color-danger); font-size: 0.875rem; margin: 0; }
.success-text { color: #2f855a; font-size: 0.875rem; margin: 0; }
</style>
