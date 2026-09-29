<script setup lang="ts">
// Landing page (design A, "bold"). Prerendered: everything that depends on the
// clock (the demo timer, the Locktober countdown) starts client-side in
// onMounted, so the static HTML is stable and hydration does not mismatch.
//
// SEO notes carried over from TASK-111/112: the title carries the terms people
// search for ("chastity timer", "online keyholder"), the visible copy says
// "chastity" too, and the JSON-LD has no offers or ratings we could not back.
const { public: { siteUrl } } = useRuntimeConfig()

const TITLE = 'ChastHub | Chastity Timer & Online Keyholder App'
const SHARE_DESC = 'A chastity timer and online keyholder app. Set a lock, hand over the key and follow the countdown live.'

useHead({
  titleTemplate: null,
  title: TITLE,
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': `${siteUrl}/#app`,
      name: 'ChastHub',
      url: siteUrl,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'iOS, Android, Windows, macOS (installable from the browser)',
      description: SHARE_DESC,
      image: `${siteUrl}/images/og-default.png`,
      publisher: { '@id': `${siteUrl}/#organization` },
      isFamilyFriendly: false,
    }),
  }],
})

useSeoMeta({
  description: 'ChastHub is a chastity timer and online keyholder app. Set a lock, give your keyholder the timer and follow the countdown live. Private, consent first, 18+.',
  ogTitle: TITLE,
  ogDescription: SHARE_DESC,
  twitterTitle: TITLE,
  twitterDescription: SHARE_DESC,
})

definePageMeta({ layout: false })

// ── Demo timer ──────────────────────────────────────────────────────────────
// A showcase of the public lock page, not real data: it is labelled "Demo".
const DEMO_START = 6 * 3600 + 14 * 60 + 32
const demoLeft = ref(DEMO_START)
const pad = (n: number) => String(n).padStart(2, '0')
const demoClock = computed(() => {
  const s = demoLeft.value
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
})
// Ring progress: the share of a 24 h lock still to go, clamped for the demo.
const RING_R = 140
const RING_C = 2 * Math.PI * RING_R
const ringDash = computed(() => {
  const share = Math.min(1, Math.max(0.04, demoLeft.value / (12 * 3600)))
  return `${(share * RING_C).toFixed(1)} ${RING_C.toFixed(1)}`
})
function addHour() { demoLeft.value += 3600 }
function subHour() { demoLeft.value = Math.max(0, demoLeft.value - 3600) }

// ── Locktober ───────────────────────────────────────────────────────────────
const LOCKTOBER_END = Date.parse('2026-11-01T00:00:00+01:00')
const now = ref<number | null>(null)
const locktoberDays = computed(() =>
  now.value === null ? null : Math.min(31, Math.max(0, Math.ceil((LOCKTOBER_END - now.value) / 86_400_000))),
)
const showLocktober = computed(() => now.value === null || now.value < LOCKTOBER_END)

let tick: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  now.value = Date.now()
  tick = setInterval(() => {
    demoLeft.value = Math.max(0, demoLeft.value - 1)
  }, 1000)
})
onUnmounted(() => clearInterval(tick))
</script>

<template>
  <div class="landing">
    <div class="landing__glow landing__glow--pink" aria-hidden="true" />
    <div class="landing__glow landing__glow--orange" aria-hidden="true" />
    <div class="landing__glow landing__glow--violet" aria-hidden="true" />

    <header class="nav">
      <NuxtLink to="/" class="brand" aria-label="ChastHub home">
        <svg class="brand__mark" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
          <defs>
            <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#EB3678" />
              <stop offset="1" stop-color="#FB773C" />
            </linearGradient>
          </defs>
          <circle cx="18" cy="18" r="15" fill="none" stroke="#4F1787" stroke-width="4" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="url(#brandGrad)" stroke-width="4" stroke-dasharray="78 95" stroke-linecap="round" transform="rotate(-90 18 18)" />
          <circle cx="18" cy="15" r="3.4" fill="url(#brandGrad)" />
          <path d="M16.2 16.5h3.6l1 6h-5.6z" fill="url(#brandGrad)" />
        </svg>
        <span class="brand__word">Chast<span class="grad-text">Hub</span></span>
      </NuxtLink>
      <nav class="nav__links" aria-label="Main">
        <a href="#how" class="nav__link nav__link--hide-sm">How it works</a>
        <a href="#safety" class="nav__link nav__link--hide-sm">Safety</a>
        <NuxtLink to="/faq" class="nav__link nav__link--hide-sm">FAQ</NuxtLink>
        <NuxtLink to="/auth/login" class="nav__link nav__link--strong">Log in</NuxtLink>
        <NuxtLink to="/auth/signup" class="pill pill--cta pill--sm">Sign up free</NuxtLink>
      </nav>
    </header>

    <div v-if="showLocktober" class="band">
      <div class="band__text">
        <span class="band__label">LOCKTOBER 2026</span>
        <span class="band__copy">Lock in for the whole month. Your first 30 days are on us.</span>
      </div>
      <span v-if="locktoberDays !== null" class="band__count">
        Ends in {{ locktoberDays }} {{ locktoberDays === 1 ? 'day' : 'days' }}
      </span>
    </div>

    <main>
      <section class="hero">
        <div class="hero__copy">
          <span class="eyebrow">FOR WEARERS &amp; KEYHOLDERS · 18+</span>
          <h1 class="hero__title">Hand over <span class="grad-text">the key.</span></h1>
          <p class="hero__sub">
            A chastity timer you do not control. Set your lock, give someone else the
            timer, and feel every hour they add. Your time is theirs now.
          </p>
          <div class="hero__ctas">
            <NuxtLink to="/auth/signup?role=wearer" class="pill pill--cta pill--lg">Start your lock for free</NuxtLink>
            <NuxtLink to="/auth/signup?role=keyholder" class="pill pill--ghost pill--lg">I'm a keyholder</NuxtLink>
          </div>
          <span class="hero__fine">No card needed · 30 days free for wearers · Keyholders always free</span>
        </div>

        <div class="demo" aria-label="Demo of a public lock">
          <div class="demo__top">
            <span class="demo__who">wearer_42 is <strong>locked</strong></span>
            <span class="demo__tag">Demo</span>
          </div>
          <div class="demo__ring">
            <svg viewBox="0 0 320 320" aria-hidden="true">
              <defs>
                <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#EB3678" />
                  <stop offset="1" stop-color="#FB773C" />
                </linearGradient>
              </defs>
              <circle cx="160" cy="160" :r="RING_R" fill="none" stroke="#4F1787" stroke-width="18" />
              <circle cx="160" cy="160" :r="RING_R" fill="none" stroke="url(#ringGrad)" stroke-width="18" stroke-linecap="round" :stroke-dasharray="ringDash" transform="rotate(-90 160 160)" class="demo__arc" />
            </svg>
            <div class="demo__center">
              <span class="demo__label">UNLOCKS IN</span>
              <span class="demo__time" aria-live="off">{{ demoClock }}</span>
              <span class="demo__note">Try the buttons</span>
            </div>
          </div>
          <div class="demo__actions">
            <button type="button" class="demo__btn demo__btn--add" @click="addHour">+1 hour</button>
            <button type="button" class="demo__btn" @click="subHour">−1 hour</button>
          </div>
          <span class="demo__foot">On a real lock, the keyholder decides whether visitors can add time.</span>
        </div>
      </section>

      <section id="how" class="section">
        <h2 class="section__title">Three steps to <span class="accent">surrender.</span></h2>
        <div class="steps">
          <article class="step">
            <span class="step__num grad-text">01</span>
            <h3 class="step__title">Set your lock</h3>
            <p class="step__text">Pick a duration, hide your combination, share how you feel. The clock starts the moment you commit.</p>
          </article>
          <article class="step">
            <span class="step__num grad-text">02</span>
            <h3 class="step__title">Hand over the key</h3>
            <p class="step__text">Send your lock to a keyholder you trust. From that moment on, the timer is in their hands.</p>
          </article>
          <article class="step">
            <span class="step__num grad-text">03</span>
            <h3 class="step__title">They take control</h3>
            <p class="step__text">Add time, take it away, pause it, end it. You watch the clock and wait.</p>
          </article>
        </div>
      </section>

      <section class="section roles">
        <article class="role role--wearer">
          <div class="role__head">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#F25A93" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /><circle cx="12" cy="16" r="1.4" /></svg>
            <span class="chip chip--pink">30 days free</span>
          </div>
          <h3 class="role__title">Wearer</h3>
          <p class="role__text">Give up the clock. Chat with your keyholder, post how you feel, and share a public link that lets others add time.</p>
          <NuxtLink to="/auth/signup?role=wearer" class="pill pill--cta">Start as wearer</NuxtLink>
        </article>
        <article class="role role--keyholder">
          <div class="role__head">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#FB773C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="4.5" /><path d="M11.2 11.2 20 20" /><path d="m16 16 2-2" /><path d="m18.5 18.5 2-2" /></svg>
            <span class="chip chip--orange">Always free</span>
          </div>
          <h3 class="role__title">Keyholder</h3>
          <p class="role__text">Hold as many keys as you like. Accept requests, set the rules and decide exactly when they're free.</p>
          <NuxtLink to="/auth/signup?role=keyholder" class="pill pill--ghost">Start as keyholder</NuxtLink>
        </article>
      </section>

      <section id="safety" class="safety" aria-label="Safety">
        <div class="safety__item">
          <span class="safety__title">Adults only</span>
          <span class="safety__text">Strictly 18+. Every account confirms it.</span>
        </div>
        <div class="safety__item">
          <span class="safety__title">Consent first</span>
          <span class="safety__text">You can end any dynamic at any time.</span>
        </div>
        <div class="safety__item">
          <span class="safety__title">Your release, always</span>
          <span class="safety__text">ChastHub keeps time. It never locks a real device.</span>
        </div>
        <div class="safety__item">
          <span class="safety__title">Private by default</span>
          <span class="safety__text">Nothing is public unless you share the link.</span>
        </div>
      </section>

      <section class="final">
        <h2 class="final__title">This Locktober, <span class="grad-text">let someone else decide.</span></h2>
        <NuxtLink to="/auth/signup?role=wearer" class="pill pill--cta pill--lg">Start your lock for free</NuxtLink>
      </section>
    </main>

    <AppFooter class="landing__footer" />
  </div>
</template>

<style scoped lang="scss">
.landing {
  position: relative;
  min-height: 100vh;
  overflow-x: hidden;
  background: var(--color-bg);
  color: var(--color-text);
}

.landing__glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;

  &--pink {
    width: 820px; height: 820px; right: -120px; top: 40px;
    background: radial-gradient(circle, rgba(var(--color-brand-rgb), 0.42) 0%, rgba(var(--color-brand-rgb), 0) 65%);
  }
  &--orange {
    width: 640px; height: 640px; right: -260px; top: 380px;
    background: radial-gradient(circle, rgba(var(--color-cta-rgb), 0.32) 0%, rgba(var(--color-cta-rgb), 0) 65%);
  }
  &--violet {
    width: 900px; height: 900px; left: -300px; top: 1000px;
    background: radial-gradient(circle, rgba(79, 23, 135, 0.7) 0%, rgba(79, 23, 135, 0) 65%);
  }
}

.nav, .band, main, .landing__footer { position: relative; z-index: 1; }

.grad-text {
  background: var(--gradient-brand);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.accent { color: var(--color-accent); }

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 16px 28px;
  border-radius: 999px;
  font-weight: 700;
  text-decoration: none;
  transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
  white-space: nowrap;

  &:hover { transform: translateY(-1px); text-decoration: none; }

  &--cta {
    background: var(--color-cta);
    color: var(--color-on-accent);
    box-shadow: 0 10px 40px rgba(var(--color-cta-rgb), 0.4);
    &:hover { color: var(--color-on-accent); box-shadow: 0 12px 48px rgba(var(--color-cta-rgb), 0.55); }
  }
  &--ghost {
    border: 1.5px solid rgba(244, 240, 255, 0.35);
    color: var(--color-text);
    font-weight: 600;
    &:hover { color: var(--color-text); border-color: rgba(244, 240, 255, 0.7); }
  }
  &--sm { padding: 11px 20px; font-size: 15px; font-weight: 600; box-shadow: none; }
  &--lg { padding: 19px 32px; font-size: 18px; }
}

/* ── Nav ─────────────────────────────────────────────────────────────────── */
.nav {
  max-width: 1280px;
  margin: 0 auto;
  height: 84px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--color-text);
  text-decoration: none;
  &:hover { text-decoration: none; color: var(--color-text); }
}
.brand__word {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.nav__links { display: flex; align-items: center; gap: 28px; font-size: 15px; }
.nav__link {
  color: #CFC5F2;
  text-decoration: none;
  &:hover { color: var(--color-text); text-decoration: none; }
  &--strong { color: var(--color-text); font-weight: 600; }
}

/* ── Locktober band ──────────────────────────────────────────────────────── */
.band {
  max-width: 1232px;
  margin: 0 auto;
  margin-inline: max(24px, calc((100% - 1232px) / 2));
  padding: 14px 24px;
  border-radius: 14px;
  background: linear-gradient(90deg, var(--color-brand), var(--color-cta));
  color: var(--color-on-accent);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.band__text { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.band__label { font-family: var(--font-display); font-weight: 700; letter-spacing: 0.14em; font-size: 14px; }
.band__copy { font-size: 15px; font-weight: 500; }
.band__count { font-family: var(--font-display); font-weight: 700; font-size: 15px; white-space: nowrap; }

/* ── Hero ────────────────────────────────────────────────────────────────── */
.hero {
  max-width: 1280px;
  margin: 0 auto;
  padding: 88px 24px 112px;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 56px;
  align-items: center;
}
.hero__copy { display: flex; flex-direction: column; gap: 26px; }
.eyebrow { font-size: 14px; letter-spacing: 0.16em; color: var(--color-accent); font-weight: 600; }
.hero__title {
  margin: 0;
  font-size: clamp(56px, 8vw, 104px);
  line-height: 0.95;
  font-weight: 700;
  letter-spacing: -0.045em;
}
.hero__sub { margin: 0; font-size: 20px; line-height: 1.55; color: #CFC5F2; max-width: 540px; }
.hero__ctas { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 6px; }
.hero__fine { font-size: 14px; color: var(--color-text-muted); }

/* ── Demo lock ───────────────────────────────────────────────────────────── */
.demo {
  justify-self: center;
  width: min(100%, 460px);
  box-sizing: border-box;
  padding: 36px;
  border-radius: 32px;
  background: rgba(24, 1, 97, 0.72);
  border: 1px solid rgba(var(--color-accent-rgb), 0.35);
  box-shadow: 0 30px 120px rgba(var(--color-brand-rgb), 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
}
.demo__top { width: 100%; display: flex; align-items: center; justify-content: space-between; }
.demo__who { font-size: 14px; color: #CFC5F2; strong { color: var(--color-text); } }
.demo__tag {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(var(--color-accent-rgb), 0.5);
  color: var(--color-accent);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.demo__ring { position: relative; width: min(100%, 300px); aspect-ratio: 1; }
.demo__ring svg { width: 100%; height: 100%; display: block; }
.demo__arc { transition: stroke-dasharray 0.4s ease; }
.demo__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.demo__label { font-size: 13px; letter-spacing: 0.2em; color: var(--color-text-muted); font-weight: 600; }
.demo__time {
  font-family: var(--font-display);
  font-size: clamp(38px, 5vw, 52px);
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.demo__note { font-size: 14px; color: #CFC5F2; }
.demo__actions { width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.demo__btn {
  height: 56px;
  border-radius: 16px;
  border: 1.5px solid var(--color-elevated);
  background: transparent;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.1s;
  &:active { transform: scale(0.97); }
  &--add {
    border: 0;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    font-weight: 700;
  }
}
.demo__foot { font-size: 13px; color: var(--color-text-muted); text-align: center; }

/* ── Sections ────────────────────────────────────────────────────────────── */
.section {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 24px 112px;
}
.section__title {
  margin: 0 0 44px;
  font-size: clamp(38px, 5vw, 56px);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.05;
}
.steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
.step {
  padding: 34px;
  border-radius: 28px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.step__num { font-family: var(--font-display); font-size: 60px; font-weight: 700; line-height: 1; }
.step__title { margin: 0; font-size: 25px; font-weight: 600; }
.step__text { margin: 0; font-size: 17px; line-height: 1.6; color: #CFC5F2; }

.roles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.role {
  padding: 44px;
  border-radius: 32px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  &--wearer { background: linear-gradient(160deg, var(--color-elevated) 0%, var(--color-surface) 70%); }
  &--keyholder { background: linear-gradient(160deg, #3A0F4F 0%, var(--color-surface) 70%); }
}
.role__head { width: 100%; display: flex; align-items: center; justify-content: space-between; }
.role__title { margin: 0; font-size: 40px; font-weight: 700; }
.role__text { margin: 0 0 6px; font-size: 18px; line-height: 1.6; color: #CFC5F2; }
.chip {
  padding: 8px 16px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 14px;
  &--pink { background: rgba(var(--color-accent-rgb), 0.16); color: var(--color-accent); }
  &--orange { background: rgba(var(--color-cta-rgb), 0.16); color: var(--color-cta); }
}

.safety {
  max-width: 1232px;
  box-sizing: border-box;
  margin: 0 auto;
  margin-inline: max(24px, calc((100% - 1232px) / 2));
  padding: 38px 44px;
  border-radius: 28px;
  border: 1px solid var(--color-border);
  background: rgba(14, 0, 51, 0.6);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 32px;
}
.safety__item { display: flex; flex-direction: column; gap: 8px; }
.safety__title { font-family: var(--font-display); font-size: 20px; font-weight: 600; }
.safety__text { font-size: 15px; line-height: 1.55; color: var(--color-text-muted); }

.final {
  max-width: 1280px;
  margin: 0 auto;
  padding: 136px 24px 104px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
  text-align: center;
}
.final__title {
  margin: 0;
  max-width: 1000px;
  font-size: clamp(44px, 7vw, 88px);
  line-height: 1;
  font-weight: 700;
  letter-spacing: -0.04em;
}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 960px) {
  .hero { grid-template-columns: minmax(0, 1fr); padding: 56px 20px 80px; gap: 48px; }
  .steps, .roles { grid-template-columns: minmax(0, 1fr); }
  .safety { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .nav__link--hide-sm { display: none; }
}

@media (max-width: 600px) {
  .nav { padding: 0 16px; height: 72px; }
  .nav__links { gap: 16px; }
  .brand__word { font-size: 21px; }
  .band { margin-inline: 16px; flex-direction: column; align-items: flex-start; gap: 6px; padding: 14px 18px; }
  .hero { padding: 44px 16px 72px; }
  .hero__sub { font-size: 18px; }
  .pill--lg { width: 100%; }
  .demo { padding: 26px 20px; border-radius: 26px; }
  .section { padding: 16px 16px 80px; }
  .step, .role { padding: 28px; }
  .role__title { font-size: 32px; }
  .safety { margin-inline: 16px; grid-template-columns: minmax(0, 1fr); padding: 28px; gap: 22px; }
  .final { padding: 96px 16px 80px; }
}
</style>
