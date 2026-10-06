<template>
  <div class="cd-page">
    <AppNav />

    <main class="cd-wrap">
      <NuxtLink to="/challenges" class="cd-back">← All challenges</NuxtLink>

      <p v-if="loading" class="cd-note">Loading…</p>
      <p v-else-if="error" class="cd-note cd-note--err">{{ error }}</p>

      <template v-else-if="data">
        <header class="cd-head">
          <h1>{{ data.challenge.title }}</h1>
          <p>{{ data.challenge.description }}</p>
          <p class="cd-when">{{ whenText }}</p>
        </header>

        <section class="cd-me" aria-label="Your place">
          <template v-if="data.me">
            <strong :class="`st st--${data.me.status}`">{{ ME_LABEL[data.me.status] }}</strong>
            <span v-if="data.me.rank">You are #{{ data.me.rank }} on the board.</span>
            <span v-else-if="data.me.status !== 'failed'">You are not on the board while you hide from rankings.</span>
          </template>
          <template v-else>
            <button type="button" class="cd-join" :disabled="!!data.join_blocked || joining" @click="join">
              {{ joining ? 'Joining…' : 'Join with my lock' }}
            </button>
            <span v-if="data.join_blocked" class="cd-why">{{ data.join_blocked }}</span>
          </template>
          <p v-if="joinError" class="cd-note cd-note--err">{{ joinError }}</p>
        </section>

        <dl class="cd-counts">
          <div><dt>Taking part</dt><dd>{{ data.counts.participants }}</dd></div>
          <div><dt>Still going</dt><dd>{{ data.counts.active }}</dd></div>
          <div><dt>Completed</dt><dd>{{ data.counts.completed }}</dd></div>
          <div><dt>Out</dt><dd>{{ data.counts.failed }}</dd></div>
        </dl>

        <section class="cd-board" aria-label="Board">
          <h2>Board</h2>
          <p v-if="!data.rows.length" class="cd-note">Nobody is on the board yet.</p>
          <ol v-else>
            <li v-for="r in data.rows" :key="r.id" :class="{ 'is-me': r.id === authStore.profile?.id }">
              <span class="rank" :class="{ 'rank--1': r.rank === 1 }">{{ r.rank }}</span>
              <UserAvatar class="av" :avatar-url="r.avatar_url" :display-name="r.display_name" />
              <span class="name">{{ r.display_name }}</span>
              <span v-if="r.status === 'completed'" class="badge">🏅 Completed</span>
              <span class="hrs">{{ spanHours(r.hours) }}</span>
            </li>
          </ol>
          <p class="cd-note">Ranked by how long the lock has run. Finishers come first. Hide from rankings on the Stats page.</p>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { spanHours } from '~/utils/lockHistory'
import type { ChallengePhase, EntryStatus } from '~/utils/challenges'

definePageMeta({ middleware: 'auth' })

interface BoardRow { rank: number; id: string; display_name: string; avatar_url: string | null; status: EntryStatus; hours: number }
interface Detail {
  challenge: { title: string; description: string | null; starts_at: string | null; ends_at: string | null; duration_minutes: number | null; phase: ChallengePhase }
  rows: BoardRow[]
  counts: { participants: number; active: number; completed: number; failed: number }
  me: { status: EntryStatus; rank: number | null } | null
  join_blocked: string | null
}

const ME_LABEL: Record<EntryStatus, string> = {
  active: "You're in. Stay locked to the finish.",
  completed: 'You completed this challenge. 🏅',
  failed: 'The challenge is over for you.',
}

const route = useRoute()
const authStore = useAuthStore()
const { authFetch } = useAuthFetch()
const slug = String(route.params.slug)

const data = ref<Detail | null>(null)
const loading = ref(true)
const error = ref('')
const joining = ref(false)
const joinError = ref('')

useHead(() => ({ title: `${data.value?.challenge.title ?? 'Challenge'} · ChastHub` }))

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
const whenText = computed(() => {
  const c = data.value?.challenge
  if (!c) return ''
  if (c.starts_at && c.ends_at) return `${day(c.starts_at)} to ${day(c.ends_at)}`
  return `${Math.round(((c.duration_minutes ?? 0) / 1440) * 10) / 10} days, counted from the day you join`
})

async function load() {
  try {
    data.value = await authFetch<Detail>(`/api/challenges/${slug}`)
  }
  catch {
    error.value = 'Could not load this challenge.'
  }
  finally {
    loading.value = false
  }
}

async function join() {
  joining.value = true
  joinError.value = ''
  try {
    await authFetch(`/api/challenges/${slug}/join`, { method: 'POST' })
    await load()
  }
  catch (e) {
    joinError.value = (e as { data?: { message?: string } }).data?.message ?? 'Could not join.'
  }
  finally {
    joining.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.cd-page { min-height: 100vh; }
.cd-wrap { max-width: 720px; margin: 0 auto; padding: 24px 16px 64px; display: flex; flex-direction: column; gap: 18px; }
.cd-back { font-size: 13px; color: var(--color-text-muted); text-decoration: none; }
.cd-note { margin: 0; font-size: 13px; color: var(--color-text-muted); &--err { color: var(--color-cta); } }

.cd-head {
  h1 { margin: 0 0 6px; font: 700 28px var(--font-display); }
  p { margin: 0; color: var(--color-text-muted); }
}
.cd-when { margin-top: 6px !important; font-size: 13px; color: var(--color-accent) !important; }

.cd-me {
  padding: 16px;
  border-radius: 20px;
  background: rgba(24, 1, 97, 0.8);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
}

.cd-join {
  align-self: flex-start;
  padding: 11px 24px;
  border: 0;
  border-radius: 999px;
  background: var(--gradient-brand);
  color: var(--color-on-accent);
  font-weight: 700;
  cursor: pointer;

  &:disabled { opacity: 0.5; cursor: default; }
}
.cd-why { font-size: 13px; color: var(--color-text-muted); }

.cd-counts {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;

  div { padding: 10px 6px; border-radius: 14px; background: var(--color-elevated); text-align: center; }
  dt { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-muted); }
  dd { margin: 2px 0 0; font: 700 20px var(--font-display); }
}

.cd-board {
  padding: 16px;
  border-radius: 20px;
  background: rgba(24, 1, 97, 0.8);
  border: 1px solid var(--color-border);

  h2 { margin: 0 0 10px; font: 700 16px var(--font-display); }
  ol { margin: 0 0 12px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
  li { display: flex; align-items: center; gap: 10px; font-size: 14px; padding: 2px 0; &.is-me { color: var(--color-accent); } }
}

.rank {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--color-elevated);
  font: 700 12px var(--font-display);

  &--1 { background: var(--gradient-brand); color: var(--color-on-accent); }
}
.av { display: block; width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; }
.name { flex: 1; min-width: 0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge { font-size: 12px; color: var(--color-accent); white-space: nowrap; }
.hrs { font: 700 15px var(--font-display); font-variant-numeric: tabular-nums; }
.st { &--active, &--completed { color: var(--color-accent); } &--failed { color: var(--color-cta); } }
</style>
