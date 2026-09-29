<script setup lang="ts">
import LoqClockPublic from '~/components/loq/LoqClockPublic.vue'
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
  ogUrl: `${siteUrl}/lock/${publicId}`,
  ogImage: `${siteUrl}/images/og-default.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'ChastHub, the platform for keyholders and wearers',
  ogSiteName: 'ChastHub',
  twitterCard: 'summary_large_image',
  twitterTitle: headline,
  twitterDescription: shareDescription,
  twitterImage: `${siteUrl}/images/og-default.png`,
})

// Locktober framing for the join card, until the month is over.
const isLocktober = ref(true)
onMounted(() => { isLocktober.value = Date.now() < Date.parse('2026-11-01T00:00:00+01:00') })

// Canonical is set site-wide from the route in app.vue (TASK-111) — setting
// it here too would emit the tag twice.
</script>

<template>
  <div class="lp">
    <div class="lp__glow lp__glow--pink" aria-hidden="true" />
    <div class="lp__glow lp__glow--orange" aria-hidden="true" />

    <div class="lp__inner">
      <header class="lp__top">
        <NuxtLink to="/" class="lp__brand" aria-label="ChastHub home">Chast<span class="lp__grad">Hub</span></NuxtLink>
        <span v-if="loq && loq.locked" class="lp__live"><span class="lp__live-dot" />LIVE</span>
      </header>

      <main class="lp__main">
        <div v-if="loading" class="lp__state">
          <div class="lp__spinner" />
          <p class="lp__state-hint">Loading lock…</p>
        </div>

        <div v-else-if="fetchError" class="lp__state">
          <p class="lp__state-title">{{ fetchError }}</p>
          <p class="lp__state-hint">The link may be broken, or the lock has been removed.</p>
          <NuxtLink to="/" class="lp__cta">Go to ChastHub</NuxtLink>
        </div>

        <template v-else-if="loq">
          <div class="lp__intro">
            <h1 class="lp__heading">{{ loq.locked ? 'Someone is locked' : 'This lock has ended' }}</h1>
            <p v-if="loq.emotion || loq.reason" class="lp__note">
              <span v-if="loq.emotion" class="lp__note-emoji">{{ emotionEmoji(loq.emotion) }}</span>
              <template v-if="loq.reason">"{{ loq.reason }}"</template>
            </p>
          </div>
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

      <footer class="lp__join">
        <span class="lp__join-text">{{ isLocktober ? 'Want your own lock this Locktober?' : 'Want your own lock?' }}</span>
        <NuxtLink :to="joinLink" class="lp__cta">Join free</NuxtLink>
      </footer>
    </div>
  </div>
</template>

<style lang="scss">
html, body, #__nuxt {
  min-height: 100%;
  margin: 0;
  background: var(--color-bg);
}
</style>

<style scoped lang="scss">
.lp {
  position: relative;
  min-height: 100dvh;
  overflow: hidden;
  background: var(--color-bg);
  color: var(--color-text);

  &__glow {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    &--pink {
      width: 640px; height: 640px; left: 50%; top: 40px; transform: translateX(-60%);
      background: radial-gradient(circle, rgba(var(--color-brand-rgb), 0.45) 0%, rgba(var(--color-brand-rgb), 0) 62%);
    }
    &--orange {
      width: 480px; height: 480px; left: 50%; top: 420px; transform: translateX(-10%);
      background: radial-gradient(circle, rgba(var(--color-cta-rgb), 0.3) 0%, rgba(var(--color-cta-rgb), 0) 62%);
    }
  }

  &__inner {
    position: relative;
    z-index: 1;
    max-width: 440px;
    min-height: 100dvh;
    margin: 0 auto;
    box-sizing: border-box;
    padding: 20px 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  &__top { display: flex; align-items: center; justify-content: space-between; }
  &__brand {
    font-family: var(--font-display);
    font-size: 21px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--color-text);
    text-decoration: none;
    &:hover { color: var(--color-text); text-decoration: none; }
  }
  &__grad {
    background: var(--gradient-brand);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  &__live {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--color-accent);
  }
  &__live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-accent);
    box-shadow: 0 0 10px var(--color-accent);
    animation: pulse 2s ease-in-out infinite;
  }

  &__main { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 18px; }
  &__intro { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; margin-top: 12px; }
  &__heading { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
  &__note { margin: 0; font-size: 15px; line-height: 1.5; color: #CFC5F2; max-width: 340px; }
  &__note-emoji { margin-right: 6px; }

  &__state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; }
  &__state-title { margin: 0; font-family: var(--font-display); font-size: 22px; font-weight: 600; }
  &__state-hint { margin: 0; font-size: 15px; color: var(--color-text-muted); }
  &__spinner {
    width: 32px; height: 32px;
    border-radius: 50%;
    border: 3px solid var(--color-elevated);
    border-top-color: var(--color-accent);
    animation: spin 0.8s linear infinite;
  }

  &__join {
    padding: 16px 18px;
    border-radius: 18px;
    background: rgba(24, 1, 97, 0.8);
    border: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  &__join-text { font-size: 14px; line-height: 1.4; color: #CFC5F2; }
  &__cta {
    flex-shrink: 0;
    padding: 12px 20px;
    border-radius: 999px;
    background: var(--color-cta);
    color: var(--color-on-accent);
    font-weight: 700;
    font-size: 14px;
    text-decoration: none;
    &:hover { color: var(--color-on-accent); text-decoration: none; }
  }
}

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 50% { opacity: 0.4; } }
</style>
