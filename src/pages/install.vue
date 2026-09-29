<template>
  <div class="dash">
    <AppNav />

    <div class="dash-body">
      <div class="dash-header">
        <div class="dash-header__text">
          <h1 class="dash-header__title">Get the ChastHub app</h1>
          <p class="dash-header__sub">
            Add ChastHub to your home screen. It opens like a normal app, full screen, and it's the
            only way to receive push notifications on iPhone.
          </p>
        </div>
      </div>

      <!-- Already installed -->
      <section v-if="isInstalled" class="install-card install-card--done">
        <p class="install-card__title">✓ You're running the installed app</p>
        <p class="install-card__text">
          Nothing left to do here. Turn on push notifications in
          <NuxtLink to="/profile">Profile → Privacy &amp; Notifications</NuxtLink>.
        </p>
      </section>

      <template v-else>
        <!-- Social webviews have no "add to home screen" entry at all -->
        <section v-if="inAppBrowser" class="install-card install-card--warn">
          <p class="install-card__title">Open ChastHub in your browser first</p>
          <p class="install-card__text">
            You opened this link inside {{ inAppBrowser }}, and its built-in browser can't add apps
            to the home screen. Tap the <strong>⋯</strong> menu in the corner and choose
            <strong>{{ platform === 'ios' ? 'Open in Safari' : 'Open in browser' }}</strong>, then
            come back to this page.
          </p>
        </section>

        <!-- Chromium can do it in one tap -->
        <section v-if="isInstallable" class="install-card install-card--cta">
          <div>
            <p class="install-card__title">Install with one tap</p>
            <p class="install-card__text">Your browser can install ChastHub for you right now.</p>
          </div>
          <button class="btn btn--primary" :disabled="installing" @click="handleInstall">
            {{ installing ? 'Installing…' : 'Install ChastHub' }}
          </button>
        </section>

        <!-- Manual instructions, one tab per platform -->
        <div class="install-tabs" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="install-tabs__tab"
            :class="{ 'install-tabs__tab--active': active === tab.id }"
            role="tab"
            :aria-selected="active === tab.id"
            @click="active = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <section class="install-card">
          <p v-if="active === platform" class="install-card__badge">That's your device</p>

          <ol class="install-steps">
            <li v-for="(step, i) in steps" :key="i" v-html="step" />
          </ol>

          <p class="install-card__note">
            <template v-if="active === 'ios'">
              On iPhone and iPad, push notifications <strong>only</strong> work from the installed
              app. The Safari tab never gets them.
            </template>
            <template v-else-if="active === 'android'">
              Some browsers call it "Install app", others "Add to Home screen". Both do the same
              thing.
            </template>
            <template v-else>
              Firefox on desktop can't install web apps; use Chrome, Edge or Safari.
            </template>
          </p>
        </section>

        <p class="install-foot">
          Once it's on your home screen, open ChastHub from that icon and enable notifications in
          <NuxtLink to="/profile">Profile → Privacy &amp; Notifications</NuxtLink>.
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { InstallPlatform } from '~/composables/usePwaInstall'

definePageMeta({ layout: 'default' })

// The "· ChastHub" suffix now comes from the site-wide titleTemplate in app.vue.
useSeoMeta({
  title: 'Install the chastity timer app',
  description: 'Add ChastHub, the chastity timer and keyholder app, to your home screen on iPhone, iPad, Android or desktop. Step-by-step instructions, no app store needed.',
  ogTitle: 'Install ChastHub on your phone',
  ogDescription: 'Add the chastity timer and keyholder app to your home screen on iPhone, iPad, Android or desktop. No app store needed.',
})

const { isInstallable, isInstalled, platform, inAppBrowser, install } = usePwaInstall()

const tabs: Array<{ id: InstallPlatform, label: string }> = [
  { id: 'ios', label: 'iPhone & iPad' },
  { id: 'android', label: 'Android' },
  { id: 'desktop', label: 'Computer' },
]

// Opens on the visitor's own platform, but all three stay reachable — people
// often read the instructions on one device and install on another.
const active = ref<InstallPlatform>('desktop')
onMounted(() => { active.value = platform.value })

const STEPS: Record<InstallPlatform, string[]> = {
  ios: [
    'Open <strong>chasthub.com</strong> in <strong>Safari</strong> (Chrome on iPhone works too).',
    'Tap the <strong>Share</strong> button: the square with an arrow pointing up, at the bottom of the screen (top right on iPad).',
    'Scroll down the list and tap <strong>Add to Home Screen</strong>.',
    'Tap <strong>Add</strong> in the top right corner.',
    'Open ChastHub from the new icon on your home screen.',
  ],
  android: [
    'Open <strong>chasthub.com</strong> in <strong>Chrome</strong>.',
    'Tap the <strong>⋮</strong> menu in the top right corner.',
    'Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).',
    'Confirm with <strong>Install</strong>.',
    'Open ChastHub from the new icon on your home screen.',
  ],
  desktop: [
    'Open <strong>chasthub.com</strong> in <strong>Chrome</strong> or <strong>Edge</strong>.',
    'Click the install icon at the right end of the address bar, or the <strong>⋮</strong> menu → <strong>Cast, save and share</strong> → <strong>Install page as app</strong>.',
    'Click <strong>Install</strong>. On Safari for Mac, use <strong>File → Add to Dock</strong> instead.',
  ],
}

const steps = computed(() => STEPS[active.value])

// TASK-112 — HowTo schema generated from STEPS rather than written separately,
// so the markup cannot drift away from the instructions actually on the page.
//
// iOS only: one HowTo per page is the useful shape, and iOS is where people
// genuinely get stuck (no install prompt exists there, so it is all manual).
// The step text is stripped of the <strong> tags it carries for display.
useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Install ChastHub on an iPhone or iPad',
      description: 'Add ChastHub to your home screen from Safari. No app store needed.',
      totalTime: 'PT1M',
      step: STEPS.ios.map((text, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        text: text.replace(/<[^>]+>/g, ''),
      })),
    }),
  }],
})

const installing = ref(false)

async function handleInstall() {
  installing.value = true
  try { await install() }
  finally { installing.value = false }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/shared-ui' as *;

.install-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  padding: 1.125rem;

  &--cta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  &--warn {
    border-color: rgba(var(--color-remove-rgb), 0.5);
    background: rgba(var(--color-remove-rgb), 0.08);
  }

  &--done {
    border-color: rgba(var(--color-accent-rgb), 0.5);
    background: rgba(var(--color-accent-rgb), 0.08);
  }

  &__title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
  }

  &__text {
    margin: 0.375rem 0 0;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--color-text-muted);

    a { color: var(--color-accent); }
  }

  &__badge {
    display: inline-block;
    margin: 0 0 0.75rem;
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm);
    background: rgba(var(--color-accent-rgb), 0.15);
    color: var(--color-accent);
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  &__note {
    margin: 1rem 0 0;
    padding-top: 0.875rem;
    border-top: 1px solid var(--color-border);
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--color-muted);
  }
}

.install-tabs {
  display: flex;
  gap: 0.375rem;

  &__tab {
    flex: 1;
    padding: 0.5rem 0.25rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-muted);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    touch-action: manipulation;

    &--active {
      border-color: var(--color-accent);
      background: rgba(var(--color-accent-rgb), 0.12);
      color: var(--color-text);
    }
  }
}

.install-steps {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--color-text-muted);

  :deep(strong) { color: var(--color-text); }
}

.install-foot {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-muted);
  text-align: center;

  a { color: var(--color-accent); }
}
</style>
