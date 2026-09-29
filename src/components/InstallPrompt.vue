<template>
  <div v-if="showPrompt" class="install-prompt">
    <div>
      <p class="install-prompt__title">Add ChastHub as an app</p>
      <p class="install-prompt__desc">
        <template v-if="inAppBrowser">
          You're inside {{ inAppBrowser }}'s built-in browser, which can't install apps. Open
          chasthub.com in {{ isIos ? 'Safari' : 'your browser' }} first.
        </template>
        <template v-else-if="isIos">
          Tap <strong>Share → Add to Home Screen</strong> in Safari, then open ChastHub from your home
          screen. On iPhone that's the only way push notifications work.
        </template>
        <template v-else>
          Install ChastHub for quick access and to enable push notifications for messages, lock requests, and expirations.
        </template>
      </p>
      <NuxtLink to="/install" class="install-prompt__link">Step-by-step instructions →</NuxtLink>
    </div>

    <button
      v-if="isInstallable"
      class="install-prompt__btn"
      :disabled="installing"
      @click="handleInstall"
    >
      {{ installing ? 'Installing…' : 'Install' }}
    </button>
  </div>
</template>

<script setup lang="ts">
const { isIos, isInstallable, inAppBrowser, showPrompt, install } = usePwaInstall()
const installing = ref(false)

async function handleInstall() {
  installing.value = true
  try { await install() }
  finally { installing.value = false }
}
</script>

<style scoped lang="scss">
.install-prompt {
  display: flex;
  align-items: flex-start;
  gap: 1rem;

  > div:first-child {
    flex: 1;
    min-width: 0;
  }

  &__title {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
  }

  &__desc {
    margin: 0.125rem 0 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    line-height: 1.45;
  }

  &__link {
    display: inline-block;
    margin-top: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-accent);
    text-decoration: none;

    &:hover { text-decoration: underline; }
  }

  &__btn {
    flex-shrink: 0;
    padding: 0.45rem 1rem;
    border-radius: var(--radius-sm);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    background: var(--color-accent);
    color: var(--color-on-accent);
    transition: opacity 0.15s;
    touch-action: manipulation;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:not(:disabled):hover {
      opacity: 0.85;
    }
  }
}
</style>
