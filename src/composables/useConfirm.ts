// Promise-based confirmation dialog. Call `confirm(...)` from anywhere and
// await a boolean, the same shape as window.confirm but styled and async.
// A single <ConfirmDialog> host (mounted in app.vue) renders the shared state.
//
// SSR is disabled (nuxt.config ssr:false), so a module-level singleton is a
// single client instance — no cross-request leakage to worry about.

import { reactive } from 'vue'

export interface ConfirmOptions {
  message: string
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

const state = reactive({
  open: false,
  title: undefined as string | undefined,
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  danger: false,
  resolve: null as ((value: boolean) => void) | null,
})

export function useConfirm() {
  function confirm(options: ConfirmOptions): Promise<boolean> {
    // Resolve any dialog still open (shouldn't happen, but never leave a
    // dangling promise) as cancelled before showing the new one.
    state.resolve?.(false)

    state.title = options.title
    state.message = options.message
    state.confirmLabel = options.confirmLabel ?? 'Confirm'
    state.cancelLabel = options.cancelLabel ?? 'Cancel'
    state.danger = options.danger ?? false
    state.open = true

    return new Promise<boolean>((resolve) => { state.resolve = resolve })
  }

  return { confirm }
}

// Used only by the <ConfirmDialog> host component.
export function useConfirmDialog() {
  function respond(value: boolean) {
    if (!state.open) return
    state.open = false
    state.resolve?.(value)
    state.resolve = null
  }
  return { state, respond }
}
