<script setup lang="ts">
import LoqClockPublic from '~/components/loq/LoqClockPublic.vue'
import logoFont from '~/assets/images/logos/chasthub-font-nobg.webp'
import { emotionEmoji } from '~/composables/useLoqFormat'

definePageMeta({ layout: false })

const { public: { signupsEnabled, siteUrl } } = useRuntimeConfig()
const joinLink = signupsEnabled ? '/auth/signup' : '/auth/login'

const route = useRoute()
const publicId = route.params.public_id as string

const {
  loq,
  countdown,
  fetchError,
  actionError,
  loading,
  adjustTimeLoading,
  lastAction,
  alreadyActed,
  feed,
  adjustTime,
} = await usePublicLoq(publicId)

// TASK-108 — this is the page people paste into Telegram, X and Discord, so
// it is the product's main viral surface. Before this it emitted no title and
// no Open Graph tags at all and every shared link previewed as a blank box.
//
// The description is generated from the countdown and the visitor permission
// rather than echoing the loqee's own `reason` note. That note is shown on
// the page, but a link preview travels much further than the page does, and
// free text lifted into it is both unpredictable and easy to abuse.

// `countdown` is the literal string "Unloqed" once the clock runs out, not a
// duration — interpolating it blindly produced "Loqed for Unloqed".
const isUnloqed = computed(() => countdown.value === 'Unlocked')
const timeLeft = computed(() => countdown.value || 'a while')

const headline = computed(() => {
  if (!loq.value) return 'Lock not found'
  return isUnloqed.value ? 'Unlocked' : `Locked for ${timeLeft.value}`
})

const shareDescription = computed(() => {
  if (!loq.value) return 'A public lock on ChastHub.'
  if (isUnloqed.value) return 'The clock has run out on this lock. See it on ChastHub.'
  const action = {
    add: 'Visitors can add time.',
    remove: 'Visitors can take time off.',
    both: 'Visitors can add or remove time.',
  }[loq.value.visitor_permission]
  return `${timeLeft.value} left on the clock. ${action}`
})

useSeoMeta({
  // No "· ChastHub" here — the site-wide titleTemplate in app.vue appends it.
  title: headline,
  description: shareDescription,
  ogTitle: headline,
  ogDescription: shareDescription,
  ogType: 'website',
  ogUrl: `${siteUrl}/loq/${publicId}`,
  ogImage: `${siteUrl}/images/og-default.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'ChastHub — the platform for Keyholders and Wearers',
  ogSiteName: 'ChastHub',
  twitterCard: 'summary_large_image',
  twitterTitle: headline,
  twitterDescription: shareDescription,
  twitterImage: `${siteUrl}/images/og-default.png`,
})

// Canonical is set site-wide from the route in app.vue (TASK-111) — setting
// it here too would emit the tag twice.
</script>

<template>
  <div class="loq-page">
    <header class="loq-page__header">
      <NuxtLink to="/" class="loq-page__logo-link">
        <img :src="logoFont" width="560" height="312" alt="ChastHub" class="loq-page__logo-font" />
      </NuxtLink>
    </header>

    <main class="loq-page__main">
      <div v-if="loading" class="loq-page__state">
        <div class="loq-page__spinner" />
        <p class="loq-page__state-hint">Loading lock…</p>
      </div>

      <div v-else-if="fetchError" class="loq-page__state">
        <span class="loq-page__state-icon">⚠️</span>
        <p class="loq-page__error-msg">{{ fetchError }}</p>
        <NuxtLink to="/" class="loq-page__cta">Go to ChastHub</NuxtLink>
      </div>

      <template v-else-if="loq">
        <div class="loq-page__badge">
          <span class="loq-page__badge-dot" />
          PUBLIC LOCK
        </div>
        <!-- The page had no h1 at all. Visually hidden rather than shown:
             the countdown is already the visual headline, but the document
             still needs one real heading. -->
        <h1 class="loq-page__heading">{{ headline }}</h1>
        <p v-if="loq.emotion || loq.reason" class="loq-page__note">
          <span v-if="loq.emotion" class="loq-page__note-emoji">{{ emotionEmoji(loq.emotion) }}</span>
          <template v-if="loq.reason">"{{ loq.reason }}"</template>
        </p>
        <LoqClockPublic
          :countdown="countdown"
          :visitor-add-hours="loq.visitor_add_hours"
          :visitor-permission="loq.visitor_permission"
          :locked="loq.locked"
          :is-paused="!!loq.paused_at"
          :adjust-time-loading="adjustTimeLoading"
          :last-action="lastAction"
          :already-acted="alreadyActed"
          :action-error="actionError"
          :feed="feed"
          @adjust-time="adjustTime"
        />
      </template>
    </main>

    <footer class="loq-page__footer">
      <p class="loq-page__tagline">Loq-based dynamic & Real-time control</p>
      <NuxtLink :to="joinLink" class="loq-page__cta">Join ChastHub</NuxtLink>
      <NuxtLink to="/" class="loq-page__home-link">chasthub.com</NuxtLink>
    </footer>
  </div>
</template>

<style lang="scss">
html, body, #__nuxt {
  height: 100%;
  margin: 0;
  background: #0c0c12;
}
</style>

<style scoped lang="scss">
$blue: #0044ff;
$blue-glow: rgba(0, 68, 255, 0.55);

.loq-page {
  min-height: 100dvh;
  background:
    radial-gradient(ellipse 90% 45% at 50% -5%, rgba(0, 68, 255, 0.13) 0%, transparent 65%),
    radial-gradient(ellipse 60% 35% at 50% 110%, rgba(80, 0, 220, 0.07) 0%, transparent 65%),
    #0c0c12;
  color: #e2e2ec;
  display: flex;
  flex-direction: column;

  &__header {
    padding: 1.75rem 2rem 1.5rem;
    display: flex;
    justify-content: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  &__logo-link {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    text-decoration: none;
    transition: opacity 0.2s;

    &:hover { opacity: 0.75; }
  }

  &__logo-font {
    height: 38px;
    width: auto;
    display: block;
    filter: brightness(1.4);
  }

  &__main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2.5rem 1.5rem;
    gap: 2rem;
  }

  &__badge {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: #6699ff;
    border: 1px solid rgba(0, 68, 255, 0.28);
    border-radius: 100px;
    padding: 0.35rem 1rem;
    background: rgba(0, 68, 255, 0.08);
    backdrop-filter: blur(4px);
  }

  // Visually hidden, still read by screen readers and search engines.
  // Not `display: none`, which would remove it from the accessibility tree.
  &__heading {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  &__badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4d88ff;
    box-shadow: 0 0 8px #4d88ff;
    animation: pulse-dot 2s ease-in-out infinite;
  }

  &__note {
    margin: 0;
    max-width: 26rem;
    text-align: center;
    font-size: 0.9375rem;
    font-style: italic;
    color: #aaaabb;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  &__note-emoji {
    font-style: normal;
    font-size: 1.25rem;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  &__spinner {
    width: 2rem;
    height: 2rem;
    border: 2px solid rgba(255, 255, 255, 0.06);
    border-top-color: #4d88ff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  &__state-icon {
    font-size: 2rem;
  }

  &__state-hint {
    color: #555;
    font-size: 0.875rem;
    text-align: center;
  }

  &__error-msg {
    color: #555;
    font-size: 1rem;
    text-align: center;
  }

  &__footer {
    padding: 2rem 1.5rem 2.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.125rem;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  &__tagline {
    margin: 0;
    font-size: 0.8125rem;
    color: #44445a;
    letter-spacing: 0.05em;
    text-align: center;
  }

  &__cta {
    display: inline-block;
    padding: 0.875rem 2.5rem;
    background: linear-gradient(135deg, #1a5aff 0%, #0033cc 100%);
    color: #fff;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.9375rem;
    letter-spacing: 0.04em;
    border-radius: 8px;
    transition: opacity 0.15s, box-shadow 0.15s, transform 0.15s;
    box-shadow: 0 4px 24px rgba(0, 68, 255, 0.4), 0 1px 0 rgba(255, 255, 255, 0.12) inset;

    &:hover {
      opacity: 0.92;
      box-shadow: 0 6px 32px rgba(0, 68, 255, 0.6), 0 1px 0 rgba(255, 255, 255, 0.12) inset;
      transform: translateY(-1px);
    }
  }

  &__home-link {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
    text-decoration: none;
    letter-spacing: 0.14em;
    transition: color 0.2s;

    &:hover { color: rgba(255, 255, 255, 0.85); }
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}
</style>
