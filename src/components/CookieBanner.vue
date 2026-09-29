<template>
  <Transition name="cookie-slide">
    <div v-if="visible" class="cookie-banner" role="dialog" aria-label="Cookie consent">
      <div class="cookie-banner__content">
        <p class="cookie-banner__text">
          We use cookies to analyse how ChastHub is used, including recordings of
          page interactions, so we can improve it. Decline and none are set.
          <NuxtLink to="/privacy" class="cookie-banner__link">Privacy policy</NuxtLink>
        </p>
        <div class="cookie-banner__actions">
          <button class="cookie-banner__btn cookie-banner__btn--decline" @click="decline">
            Decline
          </button>
          <button class="cookie-banner__btn cookie-banner__btn--accept" @click="accept">
            Accept
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const STORAGE_KEY = 'cookie_consent'

const visible = ref(false)

onMounted(() => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    visible.value = true
  }
})

function accept() {
  localStorage.setItem(STORAGE_KEY, 'accepted')
  visible.value = false
  // TASK-121 — plugins/clarity.client.ts and plugins/ga.client.ts listen for
  // this and pass the consent on to Clarity and GA4. Anything else added
  // later hooks into the same event rather than adding a second consent
  // mechanism.
  window.dispatchEvent(new CustomEvent('cookie:accepted'))
}

function decline() {
  localStorage.setItem(STORAGE_KEY, 'declined')
  visible.value = false
  // TASK-106 — InstallBanner waits for consent to be answered before taking
  // over this slot, so it has to hear about a decline too, not just accept.
  window.dispatchEvent(new CustomEvent('cookie:declined'))
}
</script>

<style scoped lang="scss">
.cookie-banner {
  position: fixed;
  bottom: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
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
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    line-height: 1.5;
    min-width: 200px;
  }

  &__link {
    color: var(--color-accent);
    text-decoration: none;

    &:hover { text-decoration: underline; }
  }

  &__actions {
    display: flex;
    gap: 0.625rem;
    flex-shrink: 0;
  }

  &__btn {
    padding: 0.5rem 1.125rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: opacity 0.15s;

    &:hover { opacity: 0.85; }

    &--decline {
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
    }

    &--accept {
      background: var(--color-accent);
      color: #fff;
      box-shadow: 0 2px 12px rgba(var(--color-accent-rgb), 0.35);
    }
  }
}

.cookie-slide-enter-active,
.cookie-slide-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}

.cookie-slide-enter-from,
.cookie-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(1rem);
}
</style>
