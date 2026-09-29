<template>
  <div class="dash">
    <AppNav />

    <div class="dash-body faq-body">
      <div class="dash-header">
        <div class="dash-header__text">
          <h1 class="dash-header__title">Frequently asked questions</h1>
          <p class="dash-header__sub">
            What ChastHub is, how sessions work, and what it costs.
          </p>
        </div>
      </div>

      <!-- Native <details>: the accordion works before the JS bundle arrives,
           the closed panels are still found by the browser's own Ctrl+F, and
           screen readers get the expand/collapse semantics for free. The first
           one is open so the page never renders as a wall of closed bars. -->
      <div class="faq">
        <details class="faq-item" open>
          <summary class="faq-item__q">What is ChastHub?</summary>
          <div class="faq-item__a">
            <p>
              ChastHub is a findom-friendly chastity app for real-time interaction, lock timers,
              messaging, and more. It's a social platform with tools built specifically for the
              chastity and findom community.
            </p>
          </div>
        </details>

        <details class="faq-item">
          <summary class="faq-item__q">Who is ChastHub for?</summary>
          <div class="faq-item__a">
            <p>
              ChastHub is made for both submissives and dominants, with user roles clearly
              distinguished by badges upon sign-up.
            </p>
            <p>
              Most importantly, ChastHub is strictly for adults aged 18 and over.
            </p>
          </div>
        </details>

        <details class="faq-item">
          <summary class="faq-item__q">What are the user roles?</summary>
          <div class="faq-item__a">
            <p>
              When you sign up for ChastHub, you choose between two user roles, each with its own
              features and functions. Your role is displayed as a badge on your profile.
            </p>

            <div class="faq-role">
              <img :src="loqeeIcon" alt="" width="48" height="48" class="faq-role__icon" decoding="async">
              <div>
                <p class="faq-role__name">Wearers — submissives</p>
                <ul>
                  <li>Create and control self-lock timers</li>
                  <li>Choose a keyholder to take control of their timers with real-time functions</li>
                </ul>
              </div>
            </div>

            <div class="faq-role">
              <img :src="loqholderIcon" alt="" width="48" height="48" class="faq-role__icon" decoding="async">
              <div>
                <p class="faq-role__name">Keyholders — dominants</p>
                <ul>
                  <li>Take control of a Wearer's timer during a session: add, remove, or pause the timer</li>
                  <li>Share a session link so others can vote in real time</li>
                </ul>
              </div>
            </div>
          </div>
        </details>

        <details class="faq-item">
          <summary class="faq-item__q">What types of session are there?</summary>
          <div class="faq-item__a">
            <p>
              <strong>Self-lock</strong> — a session you create. You set the timer and secure your
              combination, whether a number or a photo, which stays hidden until the timer runs out.
            </p>
            <p>
              <strong>Keyholder session</strong> — a session where you invite your favourite domme
              to become your Keyholder. Once they accept, control of the timer is handed over to
              them and the Wearer can no longer modify it.
            </p>
            <p>
              <strong>Public lock</strong> — don't have a Keyholder? Post your session as public.
              It becomes visible to eligible Keyholders, who can request to take control of it.
            </p>
          </div>
        </details>

        <details class="faq-item">
          <summary class="faq-item__q">What does ChastHub cost?</summary>
          <div class="faq-item__a">
            <p>
              ChastHub is user-role based, so subscription features differ depending on your role.
            </p>
            <p>
              <strong>Keyholders — free.</strong> Keyholders can use ChastHub at no cost.
            </p>
            <p>
              <strong>Wearers — 30 days free.</strong> Every new account gets a free trial with full
              access, no card required.
            </p>
            <p>
              Paid plans for wearers are coming. You will never be charged unless you choose to
              subscribe, and you can cancel at any time.
            </p>
          </div>
        </details>

        <details class="faq-item">
          <summary class="faq-item__q">What social features does ChastHub have?</summary>
          <div class="faq-item__a">
            <p>
              Customise your profile and communicate with real-time messaging.
            </p>
            <p>
              We take your privacy seriously. For more information please see our
              <NuxtLink to="/privacy">Privacy Policy</NuxtLink>.
            </p>
          </div>
        </details>

        <details class="faq-item">
          <summary class="faq-item__q">How does ChastHub keep the community safe?</summary>
          <div class="faq-item__a">
            <p>
              ChastHub is strictly 18+. We do not tolerate underage users, harmful behaviour,
              harassment, abuse, or other activity that violates our rules.
            </p>
            <p>
              Users and content can be reported, and accounts may be permanently banned when
              violations are discovered. The full rules are in our
              <NuxtLink to="/terms">Terms of Service</NuxtLink>.
            </p>
          </div>
        </details>

        <details class="faq-item">
          <summary class="faq-item__q">How do I download ChastHub?</summary>
          <div class="faq-item__a">
            <p>
              You can add ChastHub to your home screen and enable notifications to make it behave just
              like a regular app on your phone.
            </p>
            <p>
              <NuxtLink to="/install">Step-by-step instructions for your device →</NuxtLink>
            </p>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// TASK-152 — FAQ copy supplied by the client, 2026-09-24.
//
// Two topics from that copy are deliberately absent, because the code does not
// back them up and a public page is the wrong place to promise a feature:
//
//   1. Tipping. There is no tipping anywhere in the app — no UI, no API route,
//      no Stripe flow. The supplied copy stated it as live three times, and one
//      of those ("Loqholders receive 100% of the tips sent to them") also
//      contradicts terms.vue, which says a processing fee may be applied to the
//      Loqed user. Client decision: leave it out until the feature exists.
//
//   2. Suspension and blocking. The safety copy offered "blocked, suspended, or
//      permanently banned". Only the ban is real (admin/users/[id]/ban.post.ts);
//      there is no temporary suspension and no user-to-user block, so the
//      sentence below names only the ban.
//
// The original wording for both is kept at the bottom of this file so it can be
// restored rather than rewritten when the features land.
import loqholderIcon from '~/assets/images/icons/loqholder-icon.webp'
import loqeeIcon from '~/assets/images/icons/loqee-icon.webp'

definePageMeta({ layout: 'default' })

const { public: { siteUrl } } = useRuntimeConfig()

const TITLE = 'FAQ'
const DESCRIPTION = 'How ChastHub works — chastity timers, keyholder sessions, public locks, subscription pricing, and community safety.'

useSeoMeta({
  title: TITLE,
  description: DESCRIPTION,
  ogTitle: 'ChastHub FAQ — how the chastity timer and keyholder app works',
  ogDescription: DESCRIPTION,
})

// FAQPage structured data.
//
// Worth being honest about what this does and does not buy: Google restricted
// FAQ rich results to well-known government and health sites in 2023, so this
// will not produce an expandable snippet. It is still correct structured data
// that describes the page accurately, and it costs nothing to keep right.
//
// The answers are duplicated here as plain text rather than generated from the
// template — schema.org wants the answer text, and deriving it from the DOM
// would mean shipping the markup into the JSON. Keep the two in sync.
const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is ChastHub?',
    a: 'ChastHub is a findom-friendly chastity app for real-time interaction, lock timers, messaging, and more. It\'s a social platform with tools built specifically for the chastity and findom community.',
  },
  {
    q: 'Who is ChastHub for?',
    a: 'ChastHub is made for both submissives and dominants, with user roles clearly distinguished by badges upon sign-up. Most importantly, ChastHub is strictly for adults aged 18 and over.',
  },
  {
    q: 'What are the user roles?',
    a: 'When you sign up you choose between two roles, shown as a badge on your profile. Wearers (submissives) create and control self-lock timers, and can choose a keyholder to take control of their timers with real-time functions. Keyholders (dominants) take control of a Wearer\'s timer during a session — adding, removing or pausing it — and can share a session link so others can vote in real time.',
  },
  {
    q: 'What types of session are there?',
    a: 'A self-lock is a session you create yourself: you set the timer and secure your combination, whether a number or a photo, which stays hidden until the timer runs out. A Keyholder session is one where you invite a Keyholder to take over; once they accept, the Wearer can no longer modify the timer. A public lock is posted for eligible Keyholders to find and request control of.',
  },
  {
    q: 'What does ChastHub cost?',
    a: 'Keyholders use ChastHub for free. Wearers get a 30-day free trial with full access and no card required. Paid plans are coming; you will never be charged unless you choose to subscribe.',
  },
  {
    q: 'What social features does ChastHub have?',
    a: 'You can customise your profile and communicate with real-time messaging.',
  },
  {
    q: 'How does ChastHub keep the community safe?',
    a: 'ChastHub is strictly 18+. We do not tolerate underage users, harmful behaviour, harassment, abuse, or other activity that violates our rules. Users and content can be reported, and accounts may be permanently banned when violations are discovered.',
  },
  {
    q: 'How do I download ChastHub?',
    a: 'You can add ChastHub to your home screen and enable notifications to make it behave just like a regular app on your phone.',
  },
]

useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${siteUrl}/faq#faq`,
      inLanguage: 'en',
      publisher: { '@id': `${siteUrl}/#organization` },
      mainEntity: FAQS.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    }),
  }],
})

// ── Held back until the features exist (see the note at the top) ─────────────
//
// Tipping — restore into the roles answer and the pricing answer:
//
//   Loqees:      "send tips to their favourite dommes"
//   Loqholders:  "Earn tips from your locked pets"
//   Pricing:     "Loqholders receive 100% of the tips sent to them."
//
//   Before restoring the last line, reconcile it with terms.vue, which says the
//   Loqed user may be charged a processing fee — the two cannot both be true as
//   written.
//
// Enforcement — restore into the safety answer:
//
//   "accounts may be blocked, suspended, or permanently banned"
//
//   Needs a temporary-suspension state and a user-to-user block first; today
//   the only enforcement action in the code is a permanent ban.
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;

.faq-body {
  max-width: 760px;
}

.faq {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.faq-item {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.875rem;
  overflow: hidden;
  transition: border-color 0.2s;

  &:hover {
    border-color: rgba(var(--color-accent-rgb), 0.35);
  }

  &[open] {
    border-color: rgba(var(--color-accent-rgb), 0.3);
  }

  &__q {
    /* min-height rather than padding alone: this is the tap target, and 44px
       is the smallest one that reliably works on a phone. */
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
    cursor: pointer;
    list-style: none;
    user-select: none;

    /* Safari still draws its own disclosure triangle without this. */
    &::-webkit-details-marker {
      display: none;
    }

    /* Own marker, so it can be animated and sit on the right. */
    &::after {
      content: '';
      width: 0.5rem;
      height: 0.5rem;
      margin-left: auto;
      flex-shrink: 0;
      border-right: 2px solid var(--color-muted);
      border-bottom: 2px solid var(--color-muted);
      transform: rotate(45deg) translate(-0.125rem, -0.125rem);
      transition: transform 0.2s;
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: -2px;
    }
  }

  &[open] &__q::after {
    transform: rotate(-135deg) translate(-0.125rem, -0.125rem);
  }

  &__a {
    padding: 0 1rem 1rem;
    color: var(--color-text-muted);
    line-height: 1.7;
    font-size: 0.9375rem;

    p {
      margin: 0 0 0.75rem;

      &:last-child {
        margin-bottom: 0;
      }
    }

    ul {
      margin: 0.25rem 0 0;
      padding-left: 1.125rem;
    }

    li {
      margin-bottom: 0.25rem;
    }

    strong {
      color: var(--color-text);
    }

    a {
      color: var(--color-accent);
    }
  }
}

.faq-role {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  margin: 1rem 0 0;

  &__icon {
    width: 2.25rem;
    height: 2.25rem;
    object-fit: contain;
    flex-shrink: 0;
  }

  &__name {
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 0.25rem;
  }
}
</style>
