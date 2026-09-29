<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="open" class="confirm-overlay" @click.self="close">
        <div
          ref="dialogEl"
          class="delete-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          @keydown="onKeydown"
        >
          <template v-if="!followUp">
          <h2 id="delete-dialog-title" class="delete-dialog__title">Before you go</h2>
          <p class="delete-dialog__message">Deleting is permanent. {{ consequences }}</p>

          <fieldset class="delete-dialog__reasons">
            <legend class="delete-dialog__legend">What is making you leave?</legend>
            <label v-for="r in DELETION_REASONS" :key="r.value" class="reason">
              <input v-model="reason" type="radio" name="delete-reason" :value="r.value" class="reason__radio">
              <span class="reason__label">{{ r.label }}</span>
            </label>
          </fieldset>

          <div class="delete-dialog__note">
            <label for="delete-note" class="delete-dialog__note-label">
              Anything you want to add? <span class="delete-dialog__optional">Optional</span>
            </label>
            <textarea
              id="delete-note"
              v-model="note"
              class="delete-dialog__textarea"
              rows="3"
              :maxlength="DELETION_NOTE_MAX"
              placeholder="Please do not include personal details here."
            />
            <span class="delete-dialog__counter">{{ note.length }}/{{ DELETION_NOTE_MAX }}</span>
          </div>

          <div class="delete-dialog__actions">
            <button ref="cancelEl" type="button" class="confirm__btn confirm__btn--ghost" @click="close">
              Keep my account
            </button>
            <button
              type="button"
              class="confirm__btn confirm__btn--primary"
              :disabled="!reason || busy"
              @click="submit"
            >
              {{ busy ? 'Deleting…' : 'Delete my account' }}
            </button>
          </div>
          <p v-if="!reason" class="delete-dialog__hint">Pick a reason to continue.</p>
          </template>

          <!-- TASK-176 — step 2: report the problem before the account goes. -->
          <template v-else-if="followUp.step === 'report'">
            <h2 id="delete-dialog-title" class="delete-dialog__title">One more thing</h2>
            <p class="delete-dialog__message">
              <template v-if="followUp.kind === 'security'">
                You mentioned privacy. What worried you? Reports like this go straight to whoever handles security.
              </template>
              <template v-else>
                You mentioned bugs. Tell us what broke — we will look at it even after you are gone.
              </template>
            </p>
            <div class="delete-dialog__note">
              <label for="delete-report" class="delete-dialog__note-label">
                {{ followUp.kind === 'security' ? 'What did you notice?' : 'What went wrong?' }}
              </label>
              <textarea
                id="delete-report"
                ref="followUpEl"
                v-model="reportMessage"
                class="delete-dialog__textarea"
                rows="4"
                :maxlength="REPORT_MAX"
                placeholder="What happened, and where in the app. Please do not include personal details."
              />
            </div>
            <label class="delete-dialog__consent">
              <input v-model="allowContact" type="checkbox">
              <span>You may email me about this report.</span>
            </label>
            <div class="delete-dialog__actions">
              <button type="button" class="confirm__btn confirm__btn--ghost" :disabled="busy" @click="close">
                Keep my account
              </button>
              <button type="button" class="confirm__btn confirm__btn--ghost" :disabled="busy" @click="finish(false)">
                Skip &amp; delete
              </button>
              <button
                type="button"
                class="confirm__btn confirm__btn--primary"
                :disabled="busy || reportMessage.trim().length < REPORT_MIN"
                @click="finish(true)"
              >
                {{ busy ? 'Deleting…' : 'Send & delete' }}
              </button>
            </div>
            <p v-if="reportMessage.trim().length < REPORT_MIN" class="delete-dialog__hint">
              A few words ({{ REPORT_MIN }}+ characters) to send — or skip.
            </p>
          </template>

          <!-- TASK-176 — "something else" with nothing written: one sentence. -->
          <template v-else>
            <h2 id="delete-dialog-title" class="delete-dialog__title">What was it?</h2>
            <p class="delete-dialog__message">One sentence is enough — it helps us more than you would think.</p>
            <div class="delete-dialog__note">
              <textarea
                ref="followUpEl"
                v-model="note"
                class="delete-dialog__textarea"
                rows="3"
                :maxlength="DELETION_NOTE_MAX"
                aria-label="What made you leave"
                placeholder="Please do not include personal details here."
              />
              <span class="delete-dialog__counter">{{ note.length }}/{{ DELETION_NOTE_MAX }}</span>
            </div>
            <div class="delete-dialog__actions">
              <button type="button" class="confirm__btn confirm__btn--ghost" :disabled="busy" @click="close">
                Keep my account
              </button>
              <button type="button" class="confirm__btn confirm__btn--primary" :disabled="busy" @click="finish(false)">
                {{ busy ? 'Deleting…' : (note.trim() ? 'Delete my account' : 'Skip & delete') }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// TASK-138 — useConfirm takes a message and two labels, nothing else, so a
// dialog that has to collect an answer needs its own component. Kept local to
// the deletion flow rather than generalised: it has one caller, and the copy
// and the reason list are the point of it.
import { DELETION_NOTE_MAX, DELETION_REASONS, deletionFollowUp } from '~/utils/deletionReasons'
import type { DeletionFollowUp } from '~/utils/deletionReasons'

// The report API's own bounds (server/api/security/report.post.ts).
const REPORT_MIN = 10
const REPORT_MAX = 5000

const props = defineProps<{
  open: boolean
  /** Whether the consequences line should mention the subscription. */
  subscribed?: boolean
  /** Deletion in flight — keeps the dialog up with its buttons disabled. */
  busy?: boolean
}>()

const emit = defineEmits<{
  cancel: []
  // TASK-176 — `report` is set when they chose to send one from step 2.
  confirm: [payload: {
    reason: string
    note: string
    report?: { kind: 'bug' | 'security', message: string, allowContact: boolean }
  }]
}>()

const reason = ref('')
const note = ref('')
const followUp = ref<DeletionFollowUp>(null)
const reportMessage = ref('')
const allowContact = ref(false)
const followUpEl = ref<HTMLTextAreaElement | null>(null)
const dialogEl = ref<HTMLElement | null>(null)
const cancelEl = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

const consequences = computed(() =>
  props.subscribed
    ? 'Your profile, display name and avatar are erased, any running lock ends immediately, and your subscription is cancelled at the end of the period you already paid for.'
    : 'Your profile, display name and avatar are erased and any running lock ends immediately.',
)

// Reset on open, so a cancelled attempt does not pre-fill the next one.
watch(() => props.open, (open) => {
  if (open) {
    reason.value = ''
    note.value = ''
    followUp.value = null
    reportMessage.value = ''
    allowContact.value = false
    lastFocused = document.activeElement as HTMLElement | null
    nextTick(() => cancelEl.value?.focus())
  }
  else {
    lastFocused?.focus?.()
    lastFocused = null
  }
})

function close() {
  if (props.busy) return
  emit('cancel')
}

function submit() {
  if (!reason.value || props.busy) return
  // TASK-176 — some reasons get one more step before the account goes.
  const next = deletionFollowUp(reason.value, note.value)
  if (!next) {
    emit('confirm', { reason: reason.value, note: note.value.trim() })
    return
  }
  followUp.value = next
  // What they already wrote is the start of the report — never ask twice.
  if (next.step === 'report') reportMessage.value = note.value
  nextTick(() => followUpEl.value?.focus())
}

// Step 2's way out. Skipping always deletes; sending only adds the report.
function finish(send: boolean) {
  if (props.busy || !reason.value) return
  const f = followUp.value
  const report = send && f?.step === 'report' && reportMessage.value.trim().length >= REPORT_MIN
    ? { kind: f.kind, message: reportMessage.value.trim(), allowContact: allowContact.value }
    : undefined
  emit('confirm', { reason: reason.value, note: note.value.trim(), report })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  if (e.key !== 'Tab') return

  // Same focus trap as ConfirmDialog.
  const focusables = dialogEl.value?.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )
  if (!focusables || focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement

  if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  }
  else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}
</script>

<style scoped lang="scss">
// Overlay, transition and button shapes are deliberately copied from
// ConfirmDialog, so the two dialogs do not read as different objects.
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 300;
}

.delete-dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.875rem;
  padding: 1.5rem;
  width: 100%;
  max-width: 440px;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);

  &__title {
    font-size: 1.125rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text);
  }

  &__message {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--color-muted);
  }

  &__reasons {
    border: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  &__legend {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
    padding: 0 0 0.375rem;
  }

  &__note {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  &__note-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
  }

  &__optional {
    font-weight: 400;
    color: var(--color-text-muted);
  }

  &__textarea {
    width: 100%;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    padding: 0.5rem 0.625rem;
    color: var(--color-text);
    font: inherit;
    font-size: 0.875rem;
    resize: vertical;

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 1px;
    }
  }

  &__counter {
    align-self: flex-end;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  &__actions {
    display: flex;
    gap: 0.625rem;
    justify-content: flex-end;
    margin-top: 0.25rem;
    flex-wrap: wrap;
  }

  &__hint {
    margin: 0;
    align-self: flex-end;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
}

.reason {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.12s;

  &:hover { background: var(--color-bg); }

  &__radio {
    margin: 0.15rem 0 0;
    accent-color: var(--color-accent);
    flex-shrink: 0;
  }

  &__label {
    font-size: 0.875rem;
    line-height: 1.4;
    color: var(--color-text);
  }
}

.confirm__btn {
  min-height: 40px;
  padding: 0 1.125rem;
  border-radius: 0.625rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.12s, border-color 0.12s, opacity 0.12s;

  &:disabled { opacity: 0.55; cursor: not-allowed; }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  &--ghost {
    background: transparent;
    border-color: var(--color-border);
    color: var(--color-text);
    &:hover:not(:disabled) { background: var(--color-border); }
  }

  &--primary {
    background: var(--color-accent);
    color: #fff;
    &:hover:not(:disabled) { opacity: 0.88; }
  }
}

.confirm-enter-active,
.confirm-leave-active { transition: opacity 0.18s ease; }
.confirm-enter-from,
.confirm-leave-to { opacity: 0; }

.confirm-enter-active .delete-dialog { transition: transform 0.18s ease; }
.confirm-enter-from .delete-dialog { transform: translateY(8px) scale(0.98); }

@media (prefers-reduced-motion: reduce) {
  .confirm-enter-active,
  .confirm-leave-active,
  .confirm-enter-active .delete-dialog { transition: none; }
}

.delete-dialog__consent {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--color-muted);
  cursor: pointer;

  input { margin-top: 0.15rem; accent-color: var(--color-accent); }
}
</style>
