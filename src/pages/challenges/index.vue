<template>
  <div class="ch-page">
    <AppNav />

    <main class="ch-wrap">
      <header class="ch-head">
        <h1>Challenges</h1>
        <p>Take part with your lock. Stay locked to the finish and you complete it.</p>
      </header>

      <p v-if="loading" class="ch-note">Loading…</p>
      <p v-else-if="error" class="ch-note ch-note--err">{{ error }}</p>
      <p v-else-if="!challenges.length" class="ch-note">No challenges right now. Check back soon.</p>

      <ul v-else class="ch-list">
        <li v-for="c in challenges" :key="c.id">
          <NuxtLink :to="`/challenges/${c.slug}`" class="ch-card">
            <div class="ch-card__top">
              <h2>{{ c.title }}</h2>
              <span class="ch-pill" :class="`ch-pill--${c.phase}`">{{ PHASE_LABEL[c.phase] }}</span>
            </div>
            <p class="ch-card__desc">{{ c.description }}</p>
            <p class="ch-card__meta">
              <span>{{ whenText(c) }}</span>
              <span>{{ c.participants }} {{ c.participants === 1 ? 'participant' : 'participants' }}</span>
              <strong v-if="c.my_status" :class="`st st--${c.my_status}`">{{ MY_LABEL[c.my_status] }}</strong>
            </p>
          </NuxtLink>
        </li>
      </ul>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { ChallengePhase, EntryStatus } from '~/utils/challenges'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Challenges · ChastHub' })

interface ChallengeListItem {
  id: string
  slug: string
  title: string
  description: string | null
  starts_at: string | null
  ends_at: string | null
  duration_minutes: number | null
  phase: ChallengePhase
  participants: number
  my_status: EntryStatus | null
}

const PHASE_LABEL: Record<ChallengePhase, string> = { upcoming: 'Upcoming', running: 'Open', finished: 'Finished', closed: 'Closed' }
const MY_LABEL: Record<EntryStatus, string> = { active: "You're in", completed: 'Completed', failed: 'Out' }

const { authFetch } = useAuthFetch()
const challenges = ref<ChallengeListItem[]>([])
const loading = ref(true)
const error = ref('')

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
function whenText(c: ChallengeListItem) {
  if (c.starts_at && c.ends_at) return `${day(c.starts_at)} to ${day(c.ends_at)}`
  const d = (c.duration_minutes ?? 0) / 1440
  return `${Math.round(d * 10) / 10} days from when you join`
}

onMounted(async () => {
  try {
    challenges.value = (await authFetch<{ challenges: ChallengeListItem[] }>('/api/challenges')).challenges
  }
  catch {
    error.value = 'Could not load the challenges.'
  }
  finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
.ch-page { min-height: 100vh; }
.ch-wrap { max-width: 720px; margin: 0 auto; padding: 24px 16px 64px; }
.ch-head {
  margin-bottom: 20px;
  h1 { margin: 0 0 4px; font: 700 28px var(--font-display); }
  p { margin: 0; color: var(--color-text-muted); }
}
.ch-note { margin: 0; font-size: 14px; color: var(--color-text-muted); &--err { color: var(--color-cta); } }
.ch-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 12px; }

.ch-card {
  display: block;
  padding: 16px;
  border-radius: 20px;
  background: rgba(24, 1, 97, 0.8);
  border: 1px solid var(--color-border);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s;

  &:hover { border-color: var(--color-accent); }
  &__top { display: flex; align-items: center; justify-content: space-between; gap: 10px; h2 { margin: 0; font: 700 18px var(--font-display); } }
  &__desc { margin: 8px 0; font-size: 14px; color: var(--color-text-muted); }
  &__meta { margin: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; color: var(--color-text-muted); }
}

.ch-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: var(--color-elevated);
  white-space: nowrap;

  &--running { color: var(--color-accent); }
  &--upcoming { color: var(--color-cta); }
}

.st { &--active, &--completed { color: var(--color-accent); } &--failed { color: var(--color-cta); } }
</style>
