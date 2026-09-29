<script setup lang="ts">
// FAQ. The copy lives in SECTIONS below and feeds both the page and the
// FAQPage structured data, so the two can never drift apart.
//
// Every answer describes what the app does today. Deliberately NOT promised
// here until the code backs it: tipping, user-to-user blocking, temporary
// suspensions (only a permanent ban exists), and a wearer ending a lock their
// keyholder controls (only the keyholder can, see api/loqs/[id]/end.post.ts).
definePageMeta({ layout: 'default' })

const { public: { siteUrl } } = useRuntimeConfig()

interface Faq {
  q: string
  a: string[]
  list?: { term: string; text: string }[]
  link?: { to: string; label: string }
}
interface Section { id: string; title: string; items: Faq[] }

const SECTIONS: Section[] = [
  {
    id: 'start',
    title: 'Getting started',
    items: [
      {
        q: 'What is ChastHub?',
        a: ["A chastity timer you don't control. Wearers set a lock, keyholders take charge of the timer, and everyone follows the countdown live."],
      },
      {
        q: 'Who is it for?',
        a: ['Adults (18+) into chastity play: couples, long-distance dynamics, and wearers who want to find a keyholder.'],
      },
      {
        q: 'Wearer or keyholder: which one am I?',
        a: [
          'Wearers are locked. They create the lock and hand over the timer.',
          'Keyholders hold the key. They add or remove time, pause the lock and decide when it ends.',
          'Your role is fixed once you sign up, so pick the side you want to be on.',
        ],
      },
      {
        q: "What's Locktober?",
        a: ["A community tradition of staying locked for all of October. It's the perfect month to start: every new account gets 30 days free."],
      },
      {
        q: 'What does it cost?',
        a: [
          'Keyholders: always free.',
          "Wearers: 30 days free with full access, no card needed. Paid plans come later, and you're never charged unless you choose to subscribe.",
        ],
      },
      {
        q: 'Do I need to download an app?',
        a: ['No. ChastHub runs in your browser. Add it to your home screen and it works like a regular app, with notifications.'],
        link: { to: '/install', label: 'Step-by-step guide' },
      },
    ],
  },
  {
    id: 'locks',
    title: 'How locks work',
    items: [
      {
        q: 'How does a lock work?',
        a: ['You choose a duration, add your combination (a number or a photo) and how you feel. The timer starts the moment you create the lock.'],
      },
      {
        q: 'What kinds of lock are there?',
        a: [],
        list: [
          { term: 'Self-lock', text: 'you hold your own timer.' },
          { term: 'Keyholder lock', text: 'you send your lock to a specific keyholder. Once they accept, only they can change it.' },
          { term: 'Key Drop', text: 'you drop your key publicly and keyholders ask to take it. You choose who gets it.' },
        ],
      },
      {
        q: 'What is Key Drop?',
        a: ['A place where wearers drop their key for keyholders to find. Keyholders ask for a key, and the wearer approves or declines.'],
      },
      {
        q: 'What can my keyholder do?',
        a: ['Add time, take time off, pause the timer and end the lock. A keyholder can hold as many keys as they like. A wearer has one lock at a time.'],
      },
      {
        q: 'Can other people add time to my lock?',
        a: ['Only if you share your public link or drop your key in Key Drop. You decide whether visitors can add time, remove it, both or neither, and by how much. Each visitor gets one move per hour.'],
      },
      {
        q: 'When do I get my combination back?',
        a: ["It stays hidden until the lock ends. Then it's revealed to you in the app."],
      },
    ],
  },
  {
    id: 'safety',
    title: 'Safety & privacy',
    items: [
      {
        q: 'What if I need to get out early?',
        a: [
          'Your health always comes first. ChastHub only keeps time and never locks anything physical, so in an emergency remove the device. Always keep a spare key.',
          'In the app, a lock controlled by a keyholder can only be ended by them. Talk to them, and report them if they cross a line.',
        ],
      },
      {
        q: 'Who can see my lock and profile?',
        a: ['Nobody, unless you share a public link or use Key Drop. You can also hide your profile from search, hide your online status and opt out of the leaderboard.'],
      },
      {
        q: 'How do you keep the community safe?',
        a: ['Strictly 18+. Users, messages and locks can be reported, and accounts that break the rules are banned.'],
        link: { to: '/terms', label: 'Terms of Service' },
      },
      {
        q: 'How do I delete my account?',
        a: ['In your profile, at any time. Your profile is erased right away. We keep only the minimum described in our Privacy Policy, for 12 months.'],
        link: { to: '/privacy', label: 'Privacy Policy' },
      },
    ],
  },
]

const DESCRIPTION = 'How ChastHub works: roles, locks, Key Drop, pricing, safety and privacy. Answers to the questions wearers and keyholders ask most.'

useSeoMeta({
  title: 'FAQ',
  description: DESCRIPTION,
  ogTitle: 'ChastHub FAQ: how the chastity timer and keyholder app works',
  ogDescription: DESCRIPTION,
})

// FAQPage structured data, generated from the same copy as the page.
function plain(f: Faq): string {
  const parts = [...f.a, ...(f.list ?? []).map(l => `${l.term}: ${l.text}`)]
  return parts.join(' ')
}

useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${siteUrl}/faq#faq`,
      inLanguage: 'en',
      publisher: { '@id': `${siteUrl}/#organization` },
      mainEntity: SECTIONS.flatMap(s => s.items).map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: plain(f) },
      })),
    }),
  }],
})
</script>

<template>
  <div class="faqp">
    <AppNav />

    <div class="faqp__glow" aria-hidden="true" />

    <main class="faqp__body">
      <header class="faqp__head">
        <span class="faqp__eyebrow">FAQ</span>
        <h1 class="faqp__title">Questions, <span class="faqp__grad">answered.</span></h1>
        <p class="faqp__sub">Everything wearers and keyholders ask before they hand over the key.</p>
        <nav class="faqp__jump" aria-label="FAQ sections">
          <a v-for="s in SECTIONS" :key="s.id" :href="`#${s.id}`" class="faqp__chip">{{ s.title }}</a>
        </nav>
      </header>

      <section v-for="(s, si) in SECTIONS" :id="s.id" :key="s.id" class="faqp__section">
        <h2 class="faqp__section-title">{{ s.title }}</h2>
        <div class="faqp__list">
          <!-- Native <details>: works before JS loads, Ctrl+F finds closed
               answers, and screen readers get expand/collapse for free. -->
          <details
            v-for="(f, fi) in s.items"
            :key="f.q"
            class="faqp__item"
            :open="si === 0 && fi === 0"
          >
            <summary class="faqp__q">
              <span>{{ f.q }}</span>
              <span class="faqp__icon" aria-hidden="true" />
            </summary>
            <div class="faqp__a">
              <p v-for="(p, pi) in f.a" :key="pi">{{ p }}</p>
              <ul v-if="f.list" class="faqp__dl">
                <li v-for="l in f.list" :key="l.term"><strong>{{ l.term }}:</strong> {{ l.text }}</li>
              </ul>
              <NuxtLink v-if="f.link" :to="f.link.to" class="faqp__link">{{ f.link.label }} →</NuxtLink>
            </div>
          </details>
        </div>
      </section>

      <aside class="faqp__cta">
        <div>
          <p class="faqp__cta-title">Still wondering?</p>
          <p class="faqp__cta-text">Try it for 30 days. No card, no strings, just a timer you don't control.</p>
        </div>
        <div class="faqp__cta-actions">
          <NuxtLink to="/auth/signup?role=wearer" class="faqp__btn faqp__btn--cta">Start your lock for free</NuxtLink>
          <a href="mailto:founder@chasthub.com" class="faqp__btn faqp__btn--ghost">Ask us</a>
        </div>
      </aside>
    </main>
  </div>
</template>

<style scoped lang="scss">
.faqp {
  position: relative;
  overflow-x: hidden;
}

.faqp__glow {
  position: absolute;
  top: -120px;
  right: -200px;
  width: 760px;
  height: 760px;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle, rgba(var(--color-brand-rgb), 0.28) 0%, rgba(var(--color-brand-rgb), 0) 65%);
}

.faqp__body {
  position: relative;
  max-width: 820px;
  margin: 0 auto;
  padding: 64px 24px 96px;
  display: flex;
  flex-direction: column;
  gap: 56px;
}

.faqp__head { display: flex; flex-direction: column; gap: 16px; }
.faqp__eyebrow { font-size: 14px; letter-spacing: 0.16em; color: var(--color-accent); font-weight: 600; }
.faqp__title {
  margin: 0;
  font-size: clamp(44px, 7vw, 72px);
  line-height: 1;
  font-weight: 700;
  letter-spacing: -0.04em;
}
.faqp__grad {
  background: var(--gradient-brand);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.faqp__sub { margin: 0; font-size: 19px; line-height: 1.55; color: #CFC5F2; max-width: 560px; }
.faqp__jump { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
.faqp__chip {
  padding: 10px 18px;
  border-radius: 999px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: border-color 0.15s;
  &:hover { border-color: var(--color-accent); color: var(--color-text); text-decoration: none; }
}

.faqp__section { display: flex; flex-direction: column; gap: 18px; scroll-margin-top: 24px; }
.faqp__section-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.faqp__list { display: flex; flex-direction: column; gap: 10px; }

.faqp__item {
  border-radius: 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  transition: border-color 0.15s, background 0.15s;

  &:hover { border-color: var(--color-elevated); }
  &[open] {
    border-color: rgba(var(--color-accent-rgb), 0.45);
    background: linear-gradient(160deg, rgba(var(--color-brand-rgb), 0.12) 0%, var(--color-surface) 60%);
  }
}

.faqp__q {
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px;
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.01em;

  &::-webkit-details-marker { display: none; }
  &:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; border-radius: 20px; }
}

.faqp__icon {
  position: relative;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-elevated);
  transition: transform 0.2s, background 0.2s;

  &::before, &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 12px;
    height: 2px;
    border-radius: 2px;
    background: var(--color-text);
    transform: translate(-50%, -50%);
  }
  &::after { transform: translate(-50%, -50%) rotate(90deg); }
}
.faqp__item[open] .faqp__icon {
  transform: rotate(45deg);
  background: var(--gradient-brand);
  &::before, &::after { background: var(--color-on-accent); }
}

.faqp__a {
  padding: 0 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 16px;
  line-height: 1.65;
  color: #CFC5F2;

  p { margin: 0; }
}
.faqp__dl {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;

  li { padding-left: 18px; position: relative; }
  li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.62em;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--gradient-brand);
  }
  strong { color: var(--color-text); }
}
.faqp__link { align-self: flex-start; color: var(--color-accent); font-weight: 600; text-decoration: none; }

.faqp__cta {
  padding: 32px;
  border-radius: 28px;
  background: linear-gradient(160deg, var(--color-elevated) 0%, var(--color-surface) 75%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.faqp__cta-title { margin: 0 0 6px; font-family: var(--font-display); font-size: 26px; font-weight: 700; }
.faqp__cta-text { margin: 0; font-size: 16px; line-height: 1.5; color: #CFC5F2; }
.faqp__cta-actions { display: flex; gap: 10px; flex-shrink: 0; }
.faqp__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  padding: 0 22px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
  white-space: nowrap;
  &:hover { text-decoration: none; }

  &--cta {
    background: var(--color-cta);
    color: var(--color-on-accent);
    &:hover { color: var(--color-on-accent); }
  }
  &--ghost {
    border: 1.5px solid rgba(244, 240, 255, 0.35);
    color: var(--color-text);
    font-weight: 600;
    &:hover { color: var(--color-text); }
  }
}

@media (max-width: 700px) {
  .faqp__body { padding: 40px 16px 72px; gap: 44px; }
  .faqp__q { padding: 18px; font-size: 17px; }
  .faqp__a { padding: 0 18px 20px; }
  .faqp__cta { flex-direction: column; align-items: stretch; padding: 24px; }
  .faqp__cta-actions { flex-direction: column; }
}
</style>
