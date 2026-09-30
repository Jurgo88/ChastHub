<template>
  <div class="dash">
    <AppNav />

    <main class="inst">
      <!-- ── Hero ───────────────────────────────────────────────────────── -->
      <section class="hero">
        <div class="hero__text">
          <p class="hero__kicker">Get the app</p>
          <h1>Keep your lock<br><span class="grad">one tap away.</span></h1>
          <p class="hero__sub">
            Add ChastHub to your home screen. It opens full screen like any other app, and it is the
            only way to get push notifications on iPhone.
          </p>
          <ul class="hero__chips">
            <li>No app store</li>
            <li>Free</li>
            <li>Takes a minute</li>
          </ul>
        </div>

        <div class="phone" aria-hidden="true">
          <div class="phone__notch" />
          <div class="phone__time">9:41</div>
          <div class="phone__push">
            <img src="/icons/pwa-64x64.png" alt="" width="28" height="28">
            <div>
              <b>Lock time changed</b>
              <span>A visitor added +2h to your lock.</span>
            </div>
          </div>
          <div class="phone__grid">
            <i v-for="n in 7" :key="n" class="phone__app" />
            <span class="phone__icon">
              <img src="/icons/pwa-192x192.png" alt="" width="64" height="64">
              <small>ChastHub</small>
            </span>
          </div>
          <div class="phone__dock"><i /><i /><i /><i /></div>
        </div>
      </section>

      <!-- ── State ──────────────────────────────────────────────────────── -->
      <section v-if="isInstalled" class="note note--done">
        <span class="note__icon">✓</span>
        <div>
          <p class="note__title">You're running the installed app</p>
          <p class="note__text">
            Nothing left to do here. Turn on push notifications in
            <NuxtLink to="/profile?tab=notifications">Profile, Notifications</NuxtLink>.
          </p>
        </div>
      </section>

      <template v-else>
        <section v-if="inAppBrowser" class="note note--warn">
          <span class="note__icon">!</span>
          <div>
            <p class="note__title">Open ChastHub in your browser first</p>
            <p class="note__text">
              You opened this link inside {{ inAppBrowser }}, and its built-in browser can't add apps
              to the home screen. Tap the <strong>⋯</strong> menu in the corner and choose
              <strong>{{ platform === 'ios' ? 'Open in Safari' : 'Open in browser' }}</strong>, then
              come back to this page.
            </p>
          </div>
        </section>

        <section v-if="isInstallable" class="oneTap">
          <div>
            <p class="oneTap__title">Install with one tap</p>
            <p class="oneTap__text">Your browser can add ChastHub for you right now.</p>
          </div>
          <button class="oneTap__btn" type="button" :disabled="installing" @click="handleInstall">
            {{ installing ? 'Installing…' : 'Install ChastHub' }}
          </button>
        </section>

        <!-- ── Steps ────────────────────────────────────────────────────── -->
        <section class="guide">
          <div class="guide__head">
            <h2>{{ isInstallable ? 'Or do it by hand' : 'How to install' }}</h2>
            <div class="seg" role="tablist" aria-label="Device">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                type="button"
                role="tab"
                :aria-selected="active === tab.id"
                :class="{ on: active === tab.id }"
                @click="active = tab.id"
              >
                {{ tab.label }}<i v-if="tab.id === platform" class="seg__you" title="Your device" />
              </button>
            </div>
          </div>

          <ol class="steps">
            <li v-for="(step, i) in steps" :key="`${active}-${i}`" class="step">
              <span class="step__n">{{ i + 1 }}</span>
              <span class="step__t" v-html="step" />
            </li>
          </ol>

          <p class="guide__note" v-html="NOTES[active]" />
        </section>
      </template>

      <!-- ── Why ────────────────────────────────────────────────────────── -->
      <section class="why">
        <div class="why__item">
          <span class="why__ico">🔔</span>
          <b>Never miss a change</b>
          <p>Get a push when your keyholder or a Key Drop visitor adds time, when you get a message, and when your lock ends.</p>
        </div>
        <div class="why__item">
          <span class="why__ico">⚡</span>
          <b>Opens instantly</b>
          <p>Full screen, no browser bar, no tabs to hunt for. Your timer is right there.</p>
        </div>
        <div class="why__item">
          <span class="why__ico">🕶️</span>
          <b>Discreet</b>
          <p>Nothing in any app store history. Remove it any time like a normal app.</p>
        </div>
      </section>

      <p v-if="!isInstalled" class="foot">
        Once it's on your home screen, open ChastHub from that icon and turn on notifications in
        <NuxtLink to="/profile?tab=notifications">Profile, Notifications</NuxtLink>.
      </p>
    </main>
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

const NOTES: Record<InstallPlatform, string> = {
  ios: 'On iPhone and iPad, push notifications <strong>only</strong> work from the installed app. The Safari tab never gets them.',
  android: 'Some browsers call it "Install app", others "Add to Home screen". Both do the same thing.',
  desktop: 'Firefox on desktop can\'t install web apps. Use Chrome, Edge or Safari.',
}

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

.inst {
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  padding: 40px 20px 72px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.grad {
  background: var(--gradient-brand);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

// ── Hero ──────────────────────────────────────────────────────────────────
.hero {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 32px;
  align-items: center;
  padding: 40px;
  border-radius: 28px;
  border: 1px solid rgba(var(--color-accent-rgb), 0.35);
  background:
    radial-gradient(520px 300px at 100% 0%, rgba(var(--color-cta-rgb), 0.35), transparent 70%),
    radial-gradient(520px 320px at 0% 100%, rgba(var(--color-brand-rgb), 0.35), transparent 70%),
    linear-gradient(130deg, var(--color-elevated), var(--color-surface) 60%);

  &__kicker { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #FFD2C0; }

  h1 { margin: 8px 0 0; font: 700 clamp(34px, 5vw, 52px)/1.02 var(--font-display); letter-spacing: -0.03em; }

  &__sub { margin: 16px 0 0; max-width: 480px; font-size: 16px; line-height: 1.55; color: #E6DAFF; }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 20px 0 0;
    padding: 0;
    list-style: none;

    li {
      padding: 7px 14px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      font-size: 13px;
      font-weight: 600;
    }

    li:first-child { background: var(--gradient-brand); border: 0; color: var(--color-on-accent); }
  }
}

// A home screen drawn in CSS: the ChastHub icon among blank apps and a push.
.phone {
  position: relative;
  justify-self: center;
  width: 250px;
  height: 460px;
  padding: 40px 18px 18px;
  border-radius: 40px;
  border: 8px solid #0B0029;
  background:
    radial-gradient(260px 220px at 20% 10%, rgba(var(--color-brand-rgb), 0.55), transparent 70%),
    radial-gradient(260px 240px at 90% 90%, rgba(var(--color-cta-rgb), 0.45), transparent 70%),
    #1B0550;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);

  &__notch { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: 80px; height: 20px; border-radius: 999px; background: #0B0029; }
  &__time { position: absolute; top: 12px; left: 24px; font: 700 12px var(--font-sans); }

  &__push {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.14);
    animation: push-in 0.6s 0.4s backwards cubic-bezier(0.2, 0.8, 0.2, 1);

    img { display: block; border-radius: 8px; flex-shrink: 0; }
    div { min-width: 0; }
    b { display: block; font-size: 12px; }
    span { display: block; font-size: 11px; line-height: 1.35; color: #E6DAFF; }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px 12px;
    margin-top: 22px;
  }

  &__app { aspect-ratio: 1; border-radius: 12px; background: rgba(255, 255, 255, 0.12); }

  &__icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;

    width: 100%;
    min-width: 0;

    img { display: block; width: 100%; height: auto; aspect-ratio: 1; border-radius: 12px; box-shadow: 0 0 0 2px #fff, 0 0 22px rgba(var(--color-accent-rgb), 0.9); }
    small { font-size: 9px; font-weight: 600; }
  }

  &__dock {
    position: absolute;
    left: 14px;
    right: 14px;
    bottom: 14px;
    display: flex;
    justify-content: space-around;
    padding: 10px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.12);

    i { width: 36px; height: 36px; border-radius: 10px; background: rgba(255, 255, 255, 0.16); }
  }
}

@keyframes push-in {
  from { opacity: 0; transform: translateY(-14px); }
  to { opacity: 1; transform: none; }
}

// ── State cards ───────────────────────────────────────────────────────────
.note {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 18px 20px;
  border-radius: 20px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);

  &__icon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: 800;
  }

  &__title { margin: 0; font: 700 16px var(--font-display); }
  &__text { margin: 4px 0 0; font-size: 14px; line-height: 1.5; color: var(--color-text-muted); a { color: var(--color-accent); } strong { color: var(--color-text); } }

  &--done {
    border-color: rgba(61, 220, 151, 0.4);
    background: rgba(61, 220, 151, 0.07);
    .note__icon { background: var(--color-success); color: var(--color-on-accent); }
  }

  &--warn {
    border-color: rgba(var(--color-warn-rgb), 0.45);
    background: rgba(var(--color-warn-rgb), 0.08);
    .note__icon { background: var(--color-warn); color: var(--color-on-accent); }
  }
}

.oneTap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 22px 24px;
  border-radius: 22px;
  background: linear-gradient(120deg, rgba(var(--color-brand-rgb), 0.2), rgba(var(--color-cta-rgb), 0.12));
  border: 1px solid rgba(var(--color-brand-rgb), 0.45);

  &__title { margin: 0; font: 700 20px var(--font-display); }
  &__text { margin: 4px 0 0; font-size: 14px; color: #E6DAFF; }

  &__btn {
    height: 48px;
    padding: 0 26px;
    border: 0;
    border-radius: 999px;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    font: 700 15px var(--font-sans);
    cursor: pointer;

    &:disabled { opacity: 0.6; cursor: wait; }
    &:hover:not(:disabled) { opacity: 0.92; }
  }
}

// ── Guide ─────────────────────────────────────────────────────────────────
.guide {
  padding: 26px;
  border-radius: 24px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 18px;

    h2 { margin: 0; font: 700 22px var(--font-display); letter-spacing: -0.02em; }
  }

  &__note {
    margin: 18px 0 0;
    padding-top: 14px;
    border-top: 1px solid var(--color-border);
    font-size: 13px;
    line-height: 1.5;
    color: var(--color-text-muted);

    :deep(strong) { color: var(--color-text); }
  }
}

.seg {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);

  button {
    position: relative;
    padding: 8px 16px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--color-text-muted);
    font: 600 13px var(--font-sans);
    cursor: pointer;
    touch-action: manipulation;

    &.on { background: var(--color-elevated); color: var(--color-text); }
  }

  &__you {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-left: 7px;
    border-radius: 50%;
    background: var(--color-success);
    vertical-align: 1px;
  }
}

.steps {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: 18px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);

  &__n {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    font: 700 15px var(--font-display);
  }

  &__t {
    font-size: 14px;
    line-height: 1.5;
    color: var(--color-text-muted);

    :deep(strong) { color: var(--color-text); }
  }
}

// ── Why ───────────────────────────────────────────────────────────────────
.why {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  &__item {
    padding: 20px;
    border-radius: 20px;
    border: 1px solid var(--color-border);
    background: rgba(24, 1, 97, 0.6);

    b { display: block; margin-top: 10px; font: 700 16px var(--font-display); }
    p { margin: 6px 0 0; font-size: 14px; line-height: 1.5; color: var(--color-text-muted); }
  }

  &__ico { font-size: 24px; }
}

.foot {
  margin: 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-muted);

  a { color: var(--color-accent); }
}

@media (max-width: 760px) {
  .inst { padding: 20px 14px 56px; gap: 16px; }
  .hero { grid-template-columns: 1fr; padding: 26px 22px; }
  .phone { display: none; }
  .guide { padding: 20px 16px; }
  .guide__head { flex-direction: column; align-items: stretch; }
  .seg button { flex: 1; padding: 8px 6px; }
  .steps { grid-template-columns: 1fr; }
  .step { flex-direction: row; align-items: flex-start; }
  .step__n { flex-shrink: 0; }
  .why { grid-template-columns: 1fr; }
}
</style>
