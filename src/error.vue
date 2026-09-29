<script setup lang="ts">
import type { NuxtError } from '#app'
import logoFont from '~/assets/images/logos/chasthub-font-nobg.webp'

// TASK-120 — the project had no error.vue, so every bad URL fell through to
// Nuxt's built-in page: unbranded, titled "404 - Page not found: /<path> | Nuxt",
// and with no link back into the site. Since TASK-110 made unknown URLs return
// a real 404 instead of the SPA shell, that page is what visitors and crawlers
// actually land on, so it was worth having one of our own.
const props = defineProps<{ error: NuxtError }>()

const isNotFound = computed(() => props.error?.statusCode === 404)

useHead({
  titleTemplate: null,
  title: computed(() => (isNotFound.value ? 'Page not found · ChastHub' : 'Something went wrong · ChastHub')),
  // Error pages already carry a 4xx/5xx status, which keeps them out of the
  // index on its own. This is belt and braces, and costs nothing.
  meta: [{ name: 'robots', content: 'noindex, follow' }],
})

// clearError resets the error state and navigates, which is what makes the
// links work as in-app navigation rather than a full reload.
function goHome() {
  return clearError({ redirect: '/' })
}
</script>

<template>
  <div class="err">
    <main class="err__inner">
      <NuxtLink to="/" class="err__logo-link" @click.prevent="goHome">
        <img :src="logoFont" width="560" height="312" alt="ChastHub" class="err__logo" />
      </NuxtLink>

      <p class="err__code">{{ error?.statusCode ?? 500 }}</p>

      <h1 class="err__title">
        {{ isNotFound ? 'This page does not exist' : 'Something went wrong' }}
      </h1>

      <p class="err__text">
        <template v-if="isNotFound">
          The link may be broken, or the lock it pointed to has ended.
        </template>
        <template v-else>
          Nothing is broken on your side. Try again in a moment.
        </template>
      </p>

      <div class="err__actions">
        <a href="/" class="err__cta" @click.prevent="goHome">Go to ChastHub</a>
        <NuxtLink to="/install" class="err__link">Get the app</NuxtLink>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.err {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  background:
    radial-gradient(ellipse 90% 45% at 50% -5%, rgba(0, 68, 255, 0.13) 0%, transparent 65%),
    var(--color-bg, #0c0c12);
  color: var(--color-text);

  &__inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
    max-width: 30rem;
  }

  &__logo-link {
    margin-bottom: 1rem;
    transition: opacity 0.2s;

    &:hover { opacity: 0.75; }
  }

  &__logo {
    height: 38px;
    width: auto;
    display: block;
    filter: brightness(1.4);
  }

  &__code {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: var(--color-accent);
  }

  &__title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.25;
  }

  &__text {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--color-muted);
  }

  &__actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
  }

  &__cta {
    display: inline-block;
    padding: 0.875rem 2.5rem;
    border-radius: 0.5rem;
    background: linear-gradient(135deg, #1a5aff 0%, #0033cc 100%);
    color: #fff;
    font-weight: 600;
    font-size: 0.9375rem;
    text-decoration: none;
    box-shadow: 0 4px 24px rgba(0, 68, 255, 0.4);
    transition: opacity 0.15s, transform 0.15s;

    &:hover { opacity: 0.92; transform: translateY(-1px); }
  }

  &__link {
    font-size: 0.8125rem;
    color: var(--color-muted);
    text-decoration: none;

    &:hover { color: var(--color-accent); }
  }
}
</style>
