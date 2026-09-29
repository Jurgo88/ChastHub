<script setup lang="ts">
import wordmarkLogo from '~/assets/images/logos/chasthub-font-nobg.webp'
import circleLogo from '~/assets/images/logos/chasthub-logo-nobg.webp'

const route = useRoute()
const useCircleLogo = computed(() => route.meta.authLogo === 'circle')

// Intrinsic sizes of the two files. Bound rather than hardcoded because the
// wordmark and the circle have different aspect ratios — a single pair of
// attributes would reserve the wrong box for one of them (TASK-114).
const logoSize = computed(() => (useCircleLogo.value ? { w: 256, h: 246 } : { w: 560, h: 312 }))
</script>

<template>
  <div class="auth-layout">
    <div class="auth-card">
      <div class="auth-logo" :class="{ 'auth-logo--circle': useCircleLogo }">
        <img
          :src="useCircleLogo ? circleLogo : wordmarkLogo"
          :width="logoSize.w"
          :height="logoSize.h"
          alt="ChastHub"
          class="auth-logo__img"
        >
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.auth-layout {
  font-family: 'Inter', sans-serif;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: var(--color-bg);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse at 20% 50%, rgba(var(--color-accent-rgb), 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 20%, rgba(var(--color-accent-rgb), 0.06) 0%, transparent 50%),
      radial-gradient(ellipse at 60% 80%, rgba(var(--color-accent-rgb), 0.04) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }
}

.auth-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  background: rgba(var(--color-accent-rgb), 0.04);
  border: 1px solid rgba(var(--color-accent-rgb), 0.2);
  border-radius: 20px;
  padding: 2.5rem 2rem;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6), 0 0 60px rgba(var(--color-accent-rgb), 0.06);
}

.auth-logo {
  text-align: center;
  margin-bottom: 2rem;

  &__img {
    height: 44px;
    width: auto;
    object-fit: contain;
  }

  &--circle &__img {
    height: 96px;
    filter: drop-shadow(0 0 20px rgba(var(--color-accent-rgb), 0.45));
  }
}
</style>
