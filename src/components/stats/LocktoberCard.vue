<script setup lang="ts">
import type { StatsPulse } from '~/types'

// The Locktober banner: which day it is, a 31-day strip, and how many people
// are still going. Rules are spelled out underneath so nobody has to guess
// what "survivor" means.
const props = defineProps<{ locktober: StatsPulse['locktober'] }>()

const day = computed(() => props.locktober.day ?? 0)
const left = computed(() => Math.max(0, 31 - day.value))
const stillGoing = computed(() => {
  const { starters, survivors } = props.locktober
  return starters ? Math.round((survivors / starters) * 100) : 0
})
</script>

<template>
  <section class="lt">
    <div class="lt__top">
      <div>
        <p class="lt__kicker">The challenge</p>
        <h2 class="lt__title">Locktober {{ locktober.year }}</h2>
      </div>
      <div class="lt__day">
        <strong>Day {{ day }}</strong>
        <span>of 31 · {{ left }} {{ left === 1 ? 'day' : 'days' }} to go</span>
      </div>
    </div>

    <div class="lt__cal" aria-hidden="true">
      <i v-for="d in 31" :key="d" :class="{ 'lt__d--done': d < day, 'lt__d--today': d === day }" />
    </div>

    <div class="lt__stats">
      <div><strong>{{ locktober.survivors }}</strong><span>Survivors since Oct 1</span></div>
      <div><strong>{{ locktober.joined }}</strong><span>Joined Locktober</span></div>
      <div><strong>{{ stillGoing }}%</strong><span>Still going</span></div>
    </div>

    <details class="lt__rules">
      <summary>How it works</summary>
      <p>
        Be locked by the end of October 1 and stay locked. You are a survivor for as long as that
        lock keeps running. A short pause is fine (hygiene, a check-up), but a pause longer than
        24 hours or ending the lock takes you off the survivors list. Self-locks count here and are
        marked as such. You can still join later in the month: your time counts in
        "Most time" for Locktober.
      </p>
    </details>
  </section>
</template>

<style scoped lang="scss">
.lt {
  position: relative;
  overflow: hidden;
  border-radius: 26px;
  padding: 26px 28px;
  background:
    radial-gradient(500px 220px at 90% 0%, rgba(var(--color-cta-rgb), 0.45), transparent 70%),
    radial-gradient(500px 260px at 0% 100%, rgba(var(--color-brand-rgb), 0.45), transparent 70%),
    linear-gradient(120deg, var(--color-elevated), var(--color-surface));
  border: 1px solid rgba(var(--color-accent-rgb), 0.4);

  &__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
  &__kicker { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #FFD2C0; }
  &__title { margin: 6px 0 0; font: 700 34px var(--font-display); letter-spacing: -0.02em; }

  &__day {
    text-align: right;

    strong { display: block; font: 700 44px var(--font-display); line-height: 1; }
    span { font-size: 13px; color: #E6DAFF; }
  }

  &__cal {
    display: grid;
    grid-template-columns: repeat(31, minmax(0, 1fr));
    gap: 4px;
    margin: 20px 0 18px;

    i { height: 10px; border-radius: 3px; background: rgba(255, 255, 255, 0.12); }
  }

  &__d--done { background: var(--gradient-brand) !important; }
  &__d--today { background: #fff !important; box-shadow: 0 0 10px rgba(255, 255, 255, 0.7); }

  &__stats {
    display: flex;
    gap: 26px;
    flex-wrap: wrap;

    strong { font: 700 26px var(--font-display); }
    span { display: block; font-size: 12px; color: #E6DAFF; letter-spacing: 0.06em; text-transform: uppercase; }
  }

  &__rules {
    margin-top: 16px;
    font-size: 14px;
    color: #E6DAFF;

    summary { cursor: pointer; font-weight: 600; color: var(--color-text); }
    p { margin: 8px 0 0; line-height: 1.55; max-width: 640px; }
  }
}

@media (max-width: 600px) {
  .lt {
    padding: 18px;
    border-radius: 20px;

    &__title { font-size: 24px; }
    &__day strong { font-size: 32px; }
    &__cal { gap: 2px; }
  }
}
</style>
