<template>
  <div class="dash">

    <AppNav />

    <main class="dash-body">

      <header class="dash-header">
        <h1 class="dash-header__title">Key Drop</h1>
        <p class="dash-header__sub">
          Wearers who dropped their key here. Add or take time, one move per lock per hour.
        </p>
        <p v-if="pairedCount > 0" class="dash-header__stat">
          <strong>{{ pairedCount }}</strong> {{ pairedCount === 1 ? 'lock is' : 'locks are' }} paired with a keyholder right now
        </p>
      </header>

      <!-- Initial loading -->
      <div v-if="loading && items.length === 0" class="dash-state">
        <div class="spinner" />
      </div>

      <!-- Empty state -->
      <div v-else-if="items.length === 0" class="dash-state">
        <span class="dash-state__icon">🔍</span>
        <p class="dash-state__title">No keys dropped yet</p>
        <p class="dash-state__hint">
          Locks show up here once their wearer drops the key. You can drop yours from your dashboard.
        </p>
      </div>

      <!-- List -->
      <template v-else>
        <div class="discover-list">
          <article v-for="item in items" :key="item.id" class="q-card">

            <div class="q-card__header">
              <component
                :is="item.loqee.username ? 'NuxtLink' : 'div'"
                :to="item.loqee.username ? `/user/${item.loqee.username}` : undefined"
                class="q-card__who"
                :class="{ 'q-card__who--link': item.loqee.username }"
              >
                <div class="q-card__avatar">
                  <img v-if="item.loqee.avatar_url" :src="item.loqee.avatar_url" :alt="item.loqee.display_name ?? ''">
                  <span v-else>{{ initial(item.loqee.display_name) }}</span>
                </div>
                <span class="q-card__name">{{ item.loqee.display_name || 'ChastHub user' }}</span>
              </component>

              <div class="q-card__chips">
                <span v-if="item.status === 'paused'" class="chip chip--paused">Paused</span>
                <span v-if="item.seeking_loqholder" class="chip chip--seeking">Seeking keyholder</span>
                <span v-if="item.emotion" class="chip chip--emotion">{{ emotionEmoji(item.emotion) }}</span>
              </div>
            </div>

            <!-- Clock -->
            <NuxtLink
              :to="`/lock/${item.public_link_id}`"
              class="q-card__clock"
              :class="flashing[item.id] && `q-card__clock--${flashing[item.id]}`"
            >
              <span class="q-card__clock-value">{{ countdowns[item.id] || 'Not started' }}</span>
              <span class="q-card__clock-label">
                <template v-if="flashing[item.id] === 'add'">someone just added time</template>
                <template v-else-if="flashing[item.id] === 'remove'">someone just took time off</template>
                <template v-else>left on the clock</template>
              </span>
            </NuxtLink>

            <p class="q-card__reason" :class="{ 'q-card__reason--empty': !item.reason }">
              {{ item.reason || 'No note given.' }}
            </p>

            <!-- Time votes. The owner's permission governs which buttons exist
                 at all; the server enforces the same rule regardless. -->
            <div v-if="canVote(item)" class="vote">
              <button
                v-if="item.visitor_permission === 'remove' || item.visitor_permission === 'both'"
                class="btn btn--ghost btn--sm"
                :disabled="voting === item.id || votedIds.has(item.id)"
                @click="vote(item, 'remove')"
              >− {{ amountLabel(item.visitor_add_hours) }}</button>
              <button
                v-if="item.visitor_permission === 'add' || item.visitor_permission === 'both'"
                class="btn btn--primary btn--sm"
                :disabled="voting === item.id || votedIds.has(item.id)"
                @click="vote(item, 'add')"
              >+ {{ amountLabel(item.visitor_add_hours) }}</button>
              <span v-if="votedIds.has(item.id)" class="vote__done">Done. Come back in an hour</span>
            </div>
            <p v-else-if="item.visitor_permission === 'none'" class="vote__closed">
              The owner isn't taking time changes on this one.
            </p>

            <div class="q-card__footer">
              <span class="q-card__age">{{ timeAgo(item.created_at) }}</span>

              <!-- Only a loqholder can take the key, and only where one is wanted -->
              <template v-if="authStore.isLoqholder && item.seeking_loqholder">
                <button v-if="requestedIds.has(item.id)" class="btn btn--ghost btn--sm" disabled>Requested ✓</button>
                <button v-else-if="item.has_pending_request" class="btn btn--ghost btn--sm" disabled>Pending</button>
                <button
                  v-else
                  class="btn btn--primary btn--sm"
                  :disabled="!!requesting"
                  @click="requestToJoin(item)"
                >{{ requesting === item.id ? 'Requesting…' : 'Ask for this key' }}</button>
              </template>
            </div>

            <p v-if="errorId === item.id" class="card-error">{{ errorMessage }}</p>

          </article>
        </div>

        <div v-if="hasMore" class="discover-more">
          <button class="btn btn--ghost" :disabled="loading" @click="loadMore">
            {{ loading ? 'Loading…' : 'Load more' }}
          </button>
        </div>
      </template>

    </main>

  </div>
</template>

<script setup lang="ts">
import { emotionEmoji, timeAgo } from '~/composables/useLoqFormat'
import type { DiscoverVote } from '~/composables/useDiscoverFeed'
import type { VisitorPermission } from '~/types'

definePageMeta({ middleware: 'auth' })

interface DiscoverLoq {
  id: string
  public_link_id: string
  loqed_until: string | null
  status: string
  emotion: string | null
  reason: string | null
  duration_minutes: number
  visitor_add_hours: number
  visitor_permission: VisitorPermission
  seeking_loqholder: boolean
  has_pending_request: boolean
  created_at: string
  loqee: { id: string; display_name: string | null; avatar_url: string | null; username: string | null }
}

const authStore = useAuthStore()
const { authFetch } = useAuthFetch()
const { listen, publish } = useDiscoverFeed()

const PAGE_SIZE = 20

const items = ref<DiscoverLoq[]>([])
const pairedCount = ref(0)
const loading = ref(false)
const hasMore = ref(false)
const offset = ref(0)

const voting = ref<string | null>(null)
const votedIds = ref(new Set<string>())
const requesting = ref<string | null>(null)
const requestedIds = ref(new Set<string>())
const errorId = ref<string | null>(null)
const errorMessage = ref('')

// One ticker for the whole list rather than a timer per card.
const countdowns = ref<Record<string, string>>({})
let ticker: ReturnType<typeof setInterval> | null = null

// TASK-147 — which cards just moved, so the change is noticed rather than
// the number silently jumping. Cleared after a couple of seconds.
const flashing = ref<Record<string, 'add' | 'remove'>>({})
const flashTimers = new Map<string, ReturnType<typeof setTimeout>>()
let stopListening: (() => void) | null = null

function flash(loqId: string, direction: 'add' | 'remove') {
  flashing.value = { ...flashing.value, [loqId]: direction }
  clearTimeout(flashTimers.get(loqId))
  flashTimers.set(loqId, setTimeout(() => {
    const { [loqId]: _gone, ...rest } = flashing.value
    flashing.value = rest
    flashTimers.delete(loqId)
  }, 2500))
}

// Someone else voted — on this page or on the loq's share link.
function applyVote(vote: DiscoverVote) {
  const item = items.value.find(i => i.id === vote.loq_id)
  if (!item) return
  item.loqed_until = vote.loqed_until
  flash(item.id, vote.direction)
  tick()
}

onMounted(() => {
  loadPage()
  ticker = setInterval(tick, 1000)
  stopListening = listen(applyVote)
})

onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker)
  for (const timer of flashTimers.values()) clearTimeout(timer)
  flashTimers.clear()
  stopListening?.()
})

function formatMs(ms: number): string {
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  const ss = String(s).padStart(2, '0')
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${ss}s`
  if (m > 0) return `${m}m ${ss}s`
  return `${ss}s`
}

function tick() {
  const next: Record<string, string> = {}
  for (const item of items.value) {
    if (!item.loqed_until) { next[item.id] = 'Not started'; continue }
    // A paused loq's clock is frozen, so show what was left at the pause.
    const ms = new Date(item.loqed_until).getTime() - Date.now()
    next[item.id] = ms > 0 ? formatMs(ms) : 'Unlocked'
  }
  countdowns.value = next
}

async function loadPage() {
  loading.value = true
  try {
    const res = await authFetch<{ data: DiscoverLoq[]; total: number; paired_count: number }>(
      `/api/discover/loqs?limit=${PAGE_SIZE}&offset=${offset.value}`,
    )
    items.value.push(...res.data)
    pairedCount.value = res.paired_count
    hasMore.value = items.value.length < res.total
    offset.value += res.data.length
    tick()
  }
  catch { /* the empty state covers it */ }
  finally { loading.value = false }
}

function loadMore() { loadPage() }

// Your own loq is in the list like any other — you just can't vote on it.
function canVote(item: DiscoverLoq): boolean {
  return item.visitor_permission !== 'none' && item.loqee.id !== authStore.profile?.id
}

function amountLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours}h`
  return `${hours / 24}d`
}

async function vote(item: DiscoverLoq, direction: 'add' | 'remove') {
  voting.value = item.id
  errorId.value = null
  try {
    const res = await authFetch<{ new_loqed_until: string }>(
      `/api/loq/${item.public_link_id}/adjust-time`,
      { method: 'POST', body: { direction } },
    )
    item.loqed_until = res.new_loqed_until
    votedIds.value = new Set([...votedIds.value, item.id])
    flash(item.id, direction)
    tick()

    // A broadcast does not echo back to its sender, hence the local update
    // above and this for everyone else watching.
    publish({
      loq_id: item.id,
      loqed_until: res.new_loqed_until,
      direction,
      hours_changed: item.visitor_add_hours,
    })
  }
  catch (err: unknown) {
    const fe = err as { data?: { message?: string }; message?: string }
    errorMessage.value = fe?.data?.message ?? fe?.message ?? 'That did not go through.'
    errorId.value = item.id
  }
  finally { voting.value = null }
}

async function requestToJoin(item: DiscoverLoq) {
  requesting.value = item.id
  errorId.value = null
  try {
    await authFetch(`/api/loqs/${item.id}/request-to-join`, { method: 'POST' })
    requestedIds.value = new Set([...requestedIds.value, item.id])
  }
  catch (err: unknown) {
    const fe = err as { data?: { message?: string }; message?: string }
    errorMessage.value = fe?.data?.message ?? fe?.message ?? 'Failed to send request. Try another one.'
    errorId.value = item.id
  }
  finally { requesting.value = null }
}

function initial(name: string | null): string {
  return (name || '?').charAt(0).toUpperCase()
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/shared-ui' as *;

.dash-header__stat {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin-top: 0.375rem;

  strong { color: var(--color-accent); }
}

.discover-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.discover-more {
  display: flex;
  justify-content: center;
  margin-top: 1.25rem;
}

.q-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__who {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
    color: var(--color-text);

    &--link {
      text-decoration: none;
      border-radius: 0.375rem;
      transition: opacity 0.12s;
      &:hover { opacity: 0.8; }
    }
  }

  &__avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-size: 0.8125rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;

    img { width: 100%; height: 100%; object-fit: cover; }
  }

  &__name {
    font-size: 0.9375rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__chips {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  &__clock {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    text-decoration: none;
    color: var(--color-text);
    padding: 0.625rem 0;
    border-top: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);

    &:hover { color: var(--color-accent); }
  }

  &__clock-value {
    font-size: 1.375rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  &__clock-label {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    transition: color 0.2s;
  }

  // TASK-147 — a brief tint so a clock changing under you reads as an event
  // rather than a glitch. Respects reduced-motion by only changing colour.
  &__clock--add {
    .q-card__clock-value, .q-card__clock-label { color: var(--color-accent); }
  }

  &__clock--remove {
    .q-card__clock-value, .q-card__clock-label { color: #ffb020; }
  }

  &__reason {
    font-size: 0.875rem;
    color: var(--color-text);
    margin: 0;

    &--empty { color: var(--color-text-muted); font-style: italic; }
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  &__age {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
}

.chip {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  color: var(--color-text-muted);

  &--seeking { background: rgba(var(--color-accent-rgb), 0.15); color: var(--color-accent); }
  &--paused { background: rgba(255, 176, 32, 0.15); color: #ffb020; }
  &--emotion { font-size: 0.875rem; padding: 0.1rem 0.4rem; }
}

.vote {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;

  &__done {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  &__closed {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin: 0;
  }
}

.card-error {
  font-size: 0.8125rem;
  color: #e74c3c;
  margin: 0;
}
</style>
