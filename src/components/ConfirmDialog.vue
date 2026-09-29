<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div
        v-if="state.open"
        class="confirm-overlay"
        @click.self="respond(false)"
      >
        <div
          ref="dialogEl"
          class="confirm"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="state.title ? 'confirm-title' : undefined"
          aria-describedby="confirm-message"
          @keydown="onKeydown"
        >
          <h2 v-if="state.title" id="confirm-title" class="confirm__title">{{ state.title }}</h2>
          <p id="confirm-message" class="confirm__message">{{ state.message }}</p>

          <div class="confirm__actions">
            <button
              ref="cancelEl"
              type="button"
              class="confirm__btn confirm__btn--ghost"
              @click="respond(false)"
            >{{ state.cancelLabel }}</button>
            <button
              type="button"
              class="confirm__btn"
              :class="state.danger ? 'confirm__btn--danger' : 'confirm__btn--primary'"
              @click="respond(true)"
            >{{ state.confirmLabel }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const { state, respond } = useConfirmDialog()

const dialogEl = ref<HTMLElement | null>(null)
const cancelEl = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

watch(() => state.open, (open) => {
  if (open) {
    lastFocused = document.activeElement as HTMLElement | null
    nextTick(() => cancelEl.value?.focus())
  }
  else {
    // Restore focus to whatever triggered the dialog.
    lastFocused?.focus?.()
    lastFocused = null
  }
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    respond(false)
    return
  }
  if (e.key !== 'Tab') return

  // Focus trap: keep Tab within the dialog's focusable elements.
  const focusables = dialogEl.value?.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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

.confirm {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.875rem;
  padding: 1.5rem;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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

  &__actions {
    display: flex;
    gap: 0.625rem;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  &__btn {
    min-height: 40px;
    padding: 0 1.125rem;
    border-radius: 0.625rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background 0.12s, border-color 0.12s, opacity 0.12s;

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }

    &--ghost {
      background: transparent;
      border-color: var(--color-border);
      color: var(--color-text);
      &:hover { background: var(--color-border); }
    }

    &--primary {
      background: var(--color-accent);
      color: #fff;
      &:hover { opacity: 0.88; }
    }

    &--danger {
      background: var(--color-danger, #ff6b6b);
      color: #fff;
      &:hover { opacity: 0.88; }
    }
  }
}

// Enter/leave: fade overlay, lift the dialog slightly
.confirm-enter-active,
.confirm-leave-active { transition: opacity 0.18s ease; }
.confirm-enter-from,
.confirm-leave-to { opacity: 0; }

.confirm-enter-active .confirm { transition: transform 0.18s ease; }
.confirm-enter-from .confirm { transform: translateY(8px) scale(0.98); }

@media (prefers-reduced-motion: reduce) {
  .confirm-enter-active,
  .confirm-leave-active,
  .confirm-enter-active .confirm { transition: none; }
}
</style>
