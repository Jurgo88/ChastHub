<template>
  <Transition name="install-slide">
    <div v-if="visible" class="install-banner" role="dialog" aria-label="Add ChastHub to your home screen">
      <div class="install-banner__content">
        <p class="install-banner__text">
          <strong>Add ChastHub to your home screen</strong>
          <span>Opens like a real app — and it's the only way to get push notifications on iPhone.</span>
        </p>
        <div class="install-banner__actions">
          <button class="install-banner__btn install-banner__btn--dismiss" @click="dismiss">
            Not now
          </button>
          <button class="install-banner__btn install-banner__btn--show" @click="showMe">
            Show me how
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
// TASK-106 — app-wide nudge towards /install. The instructions used to live
// only in profile settings, where nobody found them.
const STORAGE_KEY = 'install_banner_dismissed'

const route = useRoute()
const { isInstalled } = usePwaInstall()

const dismissed = ref(true)

const visible = computed(() =>
  !dismissed.value && !isInstalled.value && route.path !== '/install',
)

onMounted(() => {
  // Never stack on top of the cookie banner (same fixed bottom slot): wait
  // until cookie consent has been answered before nudging about the app.
  const consentAnswered = !!readStorage('cookie_consent')
  dismissed.value = !consentAnswered || !!readStorage(STORAGE_KEY)

  if (!consentAnswered) {
    window.addEventListener('cookie:accepted', reveal, { once: true })
    window.addEventListener('cookie:declined', reveal, { once: true })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('cookie:accepted', reveal)
  window.removeEventListener('cookie:declined', reveal)
})

function reveal() {
  if (!readStorage(STORAGE_KEY)) dismissed.value = false
}

function readStorage(key: string): string | null {
  try { return localStorage.getItem(key) }
  catch { return null }
}

function dismiss() {
  try { localStorage.setItem(STORAGE_KEY, '1') }
  catch { /* private mode — banner simply reappears next visit */ }
  dismissed.value = true
}

function showMe() {
  dismiss()
  navigateTo('/install')
}
</script>

<style scoped lang="scss">
.install-banner {
  position: fixed;
  bottom: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9998; // below the cookie banner (9999)
  width: calc(100% - 2rem);
  max-width: 600px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.3);
  padding: 1rem 1.25rem;

  &__content {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    flex-wrap: wrap;
  }

  &__text {
    flex: 1;
    min-width: 200px;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: var(--color-text-muted);

    strong {
      font-size: 0.875rem;
      color: var(--color-text);
    }
  }

  &__actions {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
  }

  &__btn {
    padding: 0.45rem 0.9rem;
    border-radius: var(--radius-sm);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    touch-action: manipulation;
    white-space: nowrap;

    &--dismiss {
      border: 1px solid var(--color-border);
      background: transparent;
      color: var(--color-muted);

      &:hover { color: var(--color-text); }
    }

    &--show {
      border: none;
      background: var(--color-accent);
      color: var(--color-on-accent);

      &:hover { opacity: 0.85; }
    }
  }
}

.install-slide-enter-active,
.install-slide-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.install-slide-enter-from,
.install-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, 1rem);
}
</style>
