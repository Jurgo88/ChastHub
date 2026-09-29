<script setup lang="ts">
// TASK-111 — the most valuable SEO real estate on the domain. It was
// literally `'ChastHub '` (with a trailing space) and carried no search term.
//
// "Loqholder" and "Loqee" are product vocabulary that nobody searches for, so
// the title carries the terms people actually type: "chastity timer",
// "online keyholder", "keyholder app".
//
// The visible copy below says "chastity" too, and that is deliberate rather
// than incidental. A title promising a term the page never uses is a mismatch
// Google resolves by rewriting the title, which costs both the ranking and
// the click. The h1 stays as the brand statement; the subtitle under it is
// where the search terms land.
const { public: { siteUrl } } = useRuntimeConfig()

const TITLE = 'ChastHub — Chastity Timer & Online Keyholder App'
const SHARE_DESC = 'A chastity timer and online keyholder app. Run a timed lock, follow the countdown live, and manage your dynamic together.'

useHead({
  // `titleTemplate: null` opts out of the site-wide "· ChastHub" suffix — the
  // brand already leads here.
  titleTemplate: null,
  title: TITLE,
})

// TASK-112 — the product itself. No `offers` and no `aggregateRating`: the
// subscription prices live in Stripe rather than in this repo, and there are
// no real ratings to report. Both are better absent than invented.
useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': `${siteUrl}/#app`,
      name: 'ChastHub',
      url: siteUrl,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'iOS, Android, Windows, macOS — installable from the browser',
      description: 'A chastity timer and online keyholder app. Run a timed lock, follow the countdown live, and manage your dynamic.',
      image: `${siteUrl}/images/og-default.png`,
      publisher: { '@id': `${siteUrl}/#organization` },
      isFamilyFriendly: false,
    }),
  }],
})

useSeoMeta({
  description: 'ChastHub is a chastity timer and online keyholder app. Run a timed lock, follow the countdown live, and manage your dynamic — private and consent-first.',
  ogTitle: TITLE,
  ogDescription: SHARE_DESC,
  twitterTitle: TITLE,
  twitterDescription: SHARE_DESC,
})

import logo from '~/assets/images/logos/chasthub-font-nobg.webp'
import loqholderIcon from '~/assets/images/icons/loqholder-icon.webp'
import loqeeIcon from '~/assets/images/icons/loqee-icon.webp'


definePageMeta({ layout: false })
</script>

<template>
  <div class="page">
    <div class="container">

      <!-- Brand -->
      <div class="brand">
        <div class="lock-icon"><img :src="logo" width="250" height="139" alt="ChastHub logo: stylized blue lock symbol with glowing effect on dark background" /></div>
        <div class="brand-tagline">Control · Lock In · Submit</div>
      </div>

      <!-- Hero -->
      <h1 class="hero-title">
        The platform for<br>
        <span class="highlight">Keyholders &amp; Wearers</span>
      </h1>
      <p class="hero-subtitle">
        A safe, private space for chastity keyholding — find your match, build trust,
        and manage your dynamic.
      </p>

      <!-- Access card -->
      <div class="access-card">
        <NuxtLink to="/auth/signup" class="access-card__signup-btn">Sign up</NuxtLink>

        <div class="access-card__divider"><span>or</span></div>

        <NuxtLink to="/auth/login" class="access-card__login-btn">Log in to your account</NuxtLink>
      </div>

      <!-- Roles -->
      <div class="roles">
        <div class="role-card loqholder">
          <span class="role-emoji"><img :src="loqholderIcon" width="48" height="48" alt="Keyholder icon" /></span>
          <div class="role-name">Keyholder</div>
          <div class="role-desc">Hold the key. Set the chastity timer, manage locks, earn tips.</div>
        </div>
        <div class="role-card loqee">
          <span class="role-emoji"><img :src="loqeeIcon" width="48" height="48" alt="Wearer icon" /></span>
          <div class="role-name">Wearer</div>
          <div class="role-desc">Surrender control. Trust your keyholder, enjoy the experience.</div>
        </div>
      </div>

      <!-- Features -->
      <div class="features">
        <div class="feature">
          <div class="feature-icon">🔐</div>
          <div class="feature-label">Chastity timer with a live countdown</div>
        </div>
        <div class="feature">
          <div class="feature-icon">⏱️</div>
          <div class="feature-label">Real-time community features</div>
        </div>
        <div class="feature">
          <div class="feature-icon">🛡️</div>
          <div class="feature-label">Private &amp; secure by design</div>
        </div>
      </div>

    </div>

    <!-- TASK-153 — this page sets `layout: false`, so it does not get the
         footer from layouts/default.vue and has to mount it itself. It
         replaces the inline one that lived here, which hardcoded the year and
         linked to three pages. -->
    <AppFooter class="page__footer" />
  </div>
</template>

<style scoped>
/* ── Base ─────────────────────────────────────────────────────────────────── */

/* TASK-153 — was a centring flex row with the hero as its only child. A second
   child (the footer) would have been laid out beside the hero, so this is a
   column now: the hero centres itself with `margin: auto` in the space left
   over, and the footer sits under it. The 20px page padding moved onto the
   hero, because the footer has to run full-bleed to its own edges. */
.page {
  font-family: 'Inter', sans-serif;
  background: var(--color-bg);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  position: relative;
}

.page::before {
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

.container {
  position: relative;
  z-index: 1;
  max-width: 680px;
  width: 100%;
  /* Centres in whatever space the footer leaves, vertically and horizontally. */
  margin: auto;
  padding: 20px;
  text-align: center;
}

/* Above .page::before, which is a fixed full-viewport gradient at z-index 0. */
.page__footer {
  position: relative;
  z-index: 1;
}

/* ── Brand ────────────────────────────────────────────────────────────────── */

.brand { margin-bottom: 28px; }

.lock-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin-bottom: 8px;
  animation: pulse 3s ease-in-out infinite;
}

/* TASK-129 — the asset is a 560x312 wordmark. It used to be boxed into
   250x250 with object-fit: contain, which letterboxed ~110px of empty space
   around it, half of that above the logo. Size by width only. */
.lock-icon img {
  width: 250px;
  height: auto;
  display: block;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}

.brand-name {
  font-size: 36px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -1px;
}
.brand-name span { color: var(--color-accent); text-shadow: 0 0 12px rgba(var(--color-accent-rgb), 0.7); }

.brand-tagline {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-top: 8px;
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */

.hero-title {
  font-size: 48px;
  font-weight: 800;
  color: #fff;
  line-height: 1.1;
  margin-bottom: 20px;
  letter-spacing: -1.5px;
}

.highlight {
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 8px rgba(var(--color-accent-rgb), 0.4));
}

.hero-subtitle {
  font-size: 17px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.7;
  margin-bottom: 40px;
  max-width: 460px;
  margin-left: auto;
  margin-right: auto;
}

/* ── Access card (sign up / log in) ──────────────────────────────────────── */

.access-card {
  background: rgba(var(--color-accent-rgb), 0.05);
  border: 1px solid rgba(var(--color-accent-rgb), 0.2);
  border-radius: 20px;
  padding: 32px 32px 36px;
  margin-bottom: 40px;
}

.access-card__signup-btn,
.access-card__login-btn {
  display: block;
  width: 100%;
  padding: 16px 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
  text-decoration: none;
  text-align: center;
  transition: all 0.25s ease;
}

/* Primary — Sign up */
.access-card__signup-btn {
  color: var(--color-on-accent);
  background: var(--gradient-brand);
  box-shadow: 0 4px 24px rgba(var(--color-accent-rgb), 0.45), 0 1px 0 rgba(255, 255, 255, 0.12) inset;
}

.access-card__signup-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 32px rgba(var(--color-accent-rgb), 0.65), 0 1px 0 rgba(255, 255, 255, 0.12) inset;
}

/* Secondary — Log in */
.access-card__login-btn {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.access-card__login-btn:hover {
  background: rgba(255, 255, 255, 0.09);
  border-color: rgba(255, 255, 255, 0.22);
}

.access-card__divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0;
  color: rgba(255, 255, 255, 0.25);
  font-size: 13px;
}

.access-card__divider::before,
.access-card__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
}

/* ── Roles ────────────────────────────────────────────────────────────────── */

.roles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 40px;
}

.role-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  padding: 24px 20px;
  transition: all 0.3s ease;
}

.role-card.loqholder {
  border-color: rgba(var(--color-accent-rgb), 0.2);
}
.role-card.loqholder:hover {
  border-color: rgba(var(--color-accent-rgb), 0.5);
  background: rgba(var(--color-accent-rgb), 0.05);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(var(--color-accent-rgb), 0.1);
}

.role-card.loqee {
  border-color: rgba(var(--color-accent-rgb), 0.1);
}
.role-card.loqee:hover {
  border-color: rgba(var(--color-accent-rgb), 0.35);
  background: rgba(var(--color-accent-rgb), 0.04);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(var(--color-accent-rgb), 0.08);
}

.role-emoji { font-size: 28px; margin-bottom: 12px; display: block; }

.role-emoji img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.role-name {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
}
/* TASK-151 — "Loqholder" was green (#10b981) while "Loqee" beside it was
   white. The colour read as a status rather than a label, and the two cards
   sit side by side, so the pair looked like one of them was selected. Both
   are plain labels now. */
.role-card.loqholder .role-name,
.role-card.loqee .role-name { color: rgba(255, 255, 255, 0.85); }

.role-desc { font-size: 13px; color: rgba(255, 255, 255, 0.4); line-height: 1.5; }

/* ── Features ─────────────────────────────────────────────────────────────── */

.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 40px;
}

.feature {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  padding: 20px 16px;
  transition: border-color 0.3s;
}

.feature:hover {
  border-color: rgba(var(--color-accent-rgb), 0.3);
}

.feature-icon { font-size: 22px; margin-bottom: 8px; }
.feature-label { font-size: 12px; font-weight: 600; color: rgba(255, 255, 255, 0.5); line-height: 1.4; }

/* ── Responsive ───────────────────────────────────────────────────────────── */

@media (max-width: 580px) {
  .hero-title { font-size: 34px; }
  .roles { grid-template-columns: 1fr; }
  .features { grid-template-columns: 1fr; }
  .form-group { flex-direction: column; }
  button { width: 100%; }
  .access-card { padding: 28px 20px; }
}
</style>
