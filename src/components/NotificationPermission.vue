<template>
  <div v-if="isInitialized && !isSupported" class="notif-perm">
    <div>
      <p class="notif-perm__title">Notifications not available</p>
      <p class="notif-perm__desc">Your browser doesn't support push notifications, or the page isn't loaded over HTTPS.</p>
    </div>
  </div>
  <!-- iOS Safari browser — must be installed as PWA first -->
  <div v-else-if="isInitialized && !isStandalone && isIos" class="notif-perm">
    <div>
      <p class="notif-perm__title">Install app for notifications</p>
      <p class="notif-perm__desc">
        On iPhone, push notifications only work from the installed app.
        Tap <strong>Share → Add to Home Screen</strong>, then open ChastHub from your home screen.
      </p>
    </div>
  </div>

  <!-- Normal flow — desktop or Android or iOS standalone -->
  <div v-else-if="isInitialized" class="notif-perm-wrap">
    <div class="notif-perm">
      <div>
        <p class="notif-perm__title">
          <template v-if="isSubscribed">Push notifications on</template>
          <template v-else-if="permission === 'denied'">Notifications blocked</template>
          <template v-else>Stay in the loop</template>
        </p>
        <p class="notif-perm__desc">
          <template v-if="isSubscribed">You'll get notified for new messages, lock requests, and expirations.</template>
          <template v-else-if="permission === 'denied'">Allow notifications in your browser settings to re-enable.</template>
          <template v-else>Get notified for messages, lock requests, and expirations.</template>
        </p>
      </div>

      <button
        v-if="isSubscribed"
        class="notif-perm__btn notif-perm__btn--off"
        :disabled="isLoading"
        @click="handleUnsubscribe"
      >
        Turn off
      </button>
      <button
        v-else-if="permission !== 'denied'"
        class="notif-perm__btn notif-perm__btn--on"
        :disabled="isLoading"
        @click="handleSubscribe"
      >
        {{ isLoading ? 'Enabling…' : 'Enable' }}
      </button>
    </div>

    <p v-if="lastError" class="notif-perm__error">{{ lastError }}</p>
  </div>
</template>


<script setup lang="ts">
const { isSupported, isInitialized, isStandalone, permission, isSubscribed, isLoading, lastError, init, subscribe, unsubscribe } = usePushNotifications()

const isIos = computed(() =>
  import.meta.client && /iphone|ipad|ipod/i.test(navigator.userAgent),
)

onMounted(() => init())

async function handleSubscribe() {
  await subscribe()
}

async function handleUnsubscribe() {
  await unsubscribe()
}
</script>

<style scoped lang="scss">
.notif-perm {
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

  &__error {
    margin: 0.5rem 0 0;
    font-size: 0.75rem;
    color: var(--color-danger);
    word-break: break-word;
  }

  &__btn {
    flex-shrink: 0;
    padding: 0.45rem 1rem;
    border-radius: var(--radius-sm);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: opacity 0.15s, background 0.15s;
    touch-action: manipulation;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:not(:disabled):hover {
      opacity: 0.85;
    }

    &--on {
      background: var(--color-accent);
      color: var(--color-on-accent);
    }

    &--off {
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
    }
  }
}
</style>
