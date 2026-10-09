<template>
  <div class="dash">
    <AppNav />

    <!-- Loading -->
    <div v-if="initialising" class="dash-state">
      <div class="spinner" />
    </div>

    <div v-else class="kh">
      <!-- Page header + filter -->
      <div class="kh__header">
        <div>
          <h1 class="kh__title">Your locks</h1>
          <p class="kh__sub">{{ subline }}</p>
        </div>
        <div class="kh__tools">
          <div class="kh__filter" role="group" aria-label="Filter locks">
            <button
              v-for="f in filters"
              :key="f.key"
              type="button"
              class="kh__seg"
              :class="{ 'kh__seg--on': filter === f.key }"
              :aria-pressed="filter === f.key"
              @click="filter = f.key"
            >{{ f.label }} <span class="kh__seg-n">{{ f.count }}</span></button>
          </div>
          <NuxtLink to="/keydrop" class="kh__cta">Browse Key Drop</NuxtLink>
        </div>
      </div>

      <LockAttentionFeed
        :items="attention"
        :busy-request="pendingAction"
        @open="(item, t) => openLock(item.loq_id, t)"
        @accept-request="item => acceptRequest(item.loq_id)"
        @reject-request="item => rejectRequest(item.loq_id)"
        @changed="refreshSignals"
      />

      <!-- Requests -->
      <section v-if="filter === 'requests'" class="kh__requests" aria-label="Requests">
        <article v-for="req in requests" :key="req.id" class="kh-req">
          <div class="kh-req__who">
            <UserAvatar class="kh-req__avatar" :avatar-url="req.loq.loqee?.avatar_url" :display-name="req.loq.loqee?.display_name" />
            <div>
              <p class="kh-req__name">{{ req.loq.loqee?.display_name ?? 'Unknown' }}</p>
              <p class="kh-req__meta">
                {{ formatDuration(req.loq.duration_minutes) }} · {{ timeAgo(req.created_at) }}<template v-if="req.loq.emotion"> · {{ emotionEmoji(req.loq.emotion) }}</template>
              </p>
            </div>
            <span class="loq-status-pill loq-status-pill--request"><span class="loq-status-pill__dot" />REQUEST</span>
          </div>
          <p v-if="req.loq.reason" class="card-reason">"{{ req.loq.reason }}"</p>
          <p v-if="cardError(req.loq.id)" class="loq-card__error">{{ cardError(req.loq.id) }}</p>
          <div class="kh-req__actions">
            <button type="button" class="kh-req__btn" :disabled="pendingAction === req.loq.id" @click="rejectRequest(req.loq.id)">Reject</button>
            <button type="button" class="kh-req__btn kh-req__btn--accept" :disabled="pendingAction === req.loq.id" @click="acceptRequest(req.loq.id)">
              {{ pendingAction === req.loq.id ? 'Accepting…' : 'Accept lock' }}
            </button>
          </div>
        </article>
      </section>

      <!-- Locks: one row of cards that scrolls sideways -->
      <section v-else-if="visibleLoqs.length" class="kh-strip" aria-labelledby="kh-strip-title">
        <div class="kh-strip__head">
          <h2 id="kh-strip-title" class="kh-strip__title">Locks <span class="kh-strip__n">{{ visibleLoqs.length }}</span></h2>
          <div v-if="overflowing" class="kh-strip__nav">
            <button type="button" class="kh-strip__arrow" aria-label="Previous locks" :disabled="atStart" @click="scrollStrip(-1)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button type="button" class="kh-strip__arrow" aria-label="Next locks" :disabled="atEnd" @click="scrollStrip(1)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
        </div>
        <ul ref="trackEl" class="kh-strip__track" tabindex="0" aria-label="Locks, scroll sideways" @scroll.passive="onStripScroll">
          <li v-for="loq in visibleLoqs" :key="loq.id" class="kh-strip__item" :data-lock="loq.id">
            <LockSummaryCard
              :loq="loq"
              :now="now"
              :selected="selectedLoq?.id === loq.id"
              :pending="isPending(loq.id)"
              :flash="cardFlash(loq.id)"
              :error="cardError(loq.id)"
              @open="openLock(loq.id)"
              @add-hour="adjustTime(loq.id, 60)"
              @toggle-pause="togglePause(loq.id)"
              @expired="onExpired(loq.id)"
            />
          </li>
        </ul>
      </section>

      <!-- Empty state -->
      <div v-if="nothingVisible" class="empty-state">
        <p class="empty-state__icon"><img :src="unloqedIcon" class="state-icon" alt="" width="128" height="128" decoding="async"></p>
        <p class="empty-state__title">{{ emptyStateTitle }}</p>
        <p class="empty-state__hint">Open Key Drop to pick up a key.</p>
        <NuxtLink to="/keydrop" class="kh__cta">Open Key Drop</NuxtLink>
      </div>

      <!-- The selected lock, full width under the strip -->
      <div v-if="selectedLoq && filter !== 'requests'" ref="detailEl" class="kh__detail">
        <LockDetailPanel
          v-model:tab="tab"
          :loq="selectedLoq"
          :now="now"
          :channel="loqChannels.get(selectedLoq.id) ?? null"
          :pending="isPending(selectedLoq.id)"
          :adjust="(d: number) => adjustTime(selectedLoq!.id, d)"
          :flash="cardFlash(selectedLoq.id)"
          :error="cardError(selectedLoq.id)"
          @toggle-pause="togglePause(selectedLoq.id)"
          @end="endLoq(selectedLoq.id)"
          @expired="onExpired(selectedLoq.id)"
          @changed="refreshSignals"
        >
          <template #share>
            <LockVisitorShare :loq="selectedLoq" @patch="p => patchLoq(selectedLoq!.id, p)" />
          </template>
        </LockDetailPanel>
      </div>
    </div>
  </div>
</template>


<script setup lang="ts">
// TASK-151 — see LockCountdown: 🔓 rendered as a different padlock on every
// platform, which is a poor thing to hang an empty state on.
import unloqedIcon from '~/assets/images/icons/state-unloqed.webp'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { AttentionItem, LockSignals, Loq } from '~/types'
import { LOCK_TABS, type LockTab } from '~/utils/lockDashboard'
import { spanMinutes } from '~/utils/lockHistory'

definePageMeta({ middleware: 'auth' })

// ─── Types ─────────────────────────────────────────────────────────────────

interface LoqeeProfile { id: string; display_name: string | null; avatar_url: string | null; last_seen_at?: string | null }
type ActiveLoq = Loq & Partial<LockSignals> & { loqee: LoqeeProfile | null }

interface IncomingRequest {
  id: string
  status: string
  created_at: string
  loq: {
    id: string
    duration_minutes: number
    emotion: string | null
    reason: string | null
    is_public: boolean
    created_at: string
    loqed_until: string | null
    loqee: LoqeeProfile | null
  }
}

// Paused locks are still running sessions: "Active" counts them too, "Paused"
// only narrows the view.
type FilterKey = 'all' | 'active' | 'paused' | 'requests'

// ─── State ─────────────────────────────────────────────────────────────────

const authStore = useAuthStore()
const { authFetch } = useAuthFetch()
const { acceptLoq, rejectLoq, togglePause: pauseLoq, endLoq: endLoqAction, adjustTime: adjustLoqTime } = useLoqholder()
const { $supabase } = useNuxtApp()
const { confirm } = useConfirm()
const route = useRoute()
const router = useRouter()

const initialising = ref(true)
const activeLoqs = ref<ActiveLoq[]>([])
const requests = ref<IncomingRequest[]>([])
const attention = ref<AttentionItem[]>([])
const filter = ref<FilterKey>('all')
const pendingAction = ref<string | null>(null)

const pendingIds = ref(new Set<string>())
const errorMap = ref(new Map<string, string>())
const flashMap = ref(new Map<string, string>())

// One clock for every card's progress bar and deadline chips.
const now = ref(Date.now())

// shallow: the channels themselves must not be wrapped in proxies.
const loqChannels = shallowReactive(new Map<string, RealtimeChannel>())
let requestChannel: RealtimeChannel | null = null
let visitorInteractionChannel: RealtimeChannel | null = null

// ─── Lock strip (one row of cards, scrolls sideways) ───────────────────────

const trackEl = ref<HTMLElement | null>(null)
const detailEl = ref<HTMLElement | null>(null)
const atStart = ref(true)
const atEnd = ref(true)
const overflowing = computed(() => !(atStart.value && atEnd.value))

function onStripScroll() {
  const el = trackEl.value
  if (!el) return
  atStart.value = el.scrollLeft <= 4
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
}

const reducedMotion = () => import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Pages by what is visible, minus one card so the next page starts with context.
function scrollStrip(dir: 1 | -1) {
  const el = trackEl.value
  if (!el) return
  const card = el.querySelector<HTMLElement>('.kh-strip__item')
  const step = Math.max(card?.offsetWidth ?? 300, el.clientWidth - (card?.offsetWidth ?? 0))
  el.scrollBy({ left: dir * step, behavior: reducedMotion() ? 'auto' : 'smooth' })
}

function revealCard(loqId: string) {
  const card = trackEl.value?.querySelector<HTMLElement>(`[data-lock="${loqId}"]`)
  card?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
}

let resizeObserver: ResizeObserver | null = null
watch(trackEl, (el, old) => {
  if (old) resizeObserver?.unobserve(old)
  if (el) {
    resizeObserver?.observe(el)
    nextTick(onStripScroll)
  }
})

// ─── Selection (kept in the URL: back button and shared links work) ────────

const selectedId = computed(() => (typeof route.query.lock === 'string' ? route.query.lock : null))

const tab = computed<LockTab>({
  get: () => {
    const t = route.query.tab
    return typeof t === 'string' && (LOCK_TABS as readonly string[]).includes(t) ? t as LockTab : 'overview'
  },
  set: (t) => { router.replace({ query: { ...route.query, tab: t === 'overview' ? undefined : t } }) },
})

// The first lock is open by default, so the panel under the strip is never empty.
const selectedLoq = computed<ActiveLoq | null>(() => {
  const picked = selectedId.value ? visibleLoqs.value.find(l => l.id === selectedId.value) : null
  return picked ?? visibleLoqs.value[0] ?? null
})

function openLock(loqId: string, t: LockTab = 'overview') {
  if (!activeLoqs.value.some(l => l.id === loqId)) return
  if (filter.value === 'requests' || (filter.value === 'paused' && !visibleLoqs.value.some(l => l.id === loqId))) filter.value = 'all'
  router.replace({ query: { ...route.query, lock: loqId, tab: t === 'overview' ? undefined : t } })
  nextTick(() => {
    revealCard(loqId)
    // The panel sits under the strip: bring it up when it is out of sight.
    const panel = detailEl.value
    if (panel && panel.getBoundingClientRect().top > window.innerHeight * 0.6) {
      panel.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
    }
  })
}

function closeLock() {
  router.replace({ query: { ...route.query, lock: undefined, tab: undefined } })
}

// ─── Computed ───────────────────────────────────────────────────────────────

const pausedCount = computed(() => activeLoqs.value.filter(l => l.status === 'paused').length)

const filters = computed<{ key: FilterKey; label: string; count: number }[]>(() => [
  { key: 'all', label: 'All', count: activeLoqs.value.length + requests.value.length },
  { key: 'active', label: 'Active', count: activeLoqs.value.length },
  { key: 'paused', label: 'Paused', count: pausedCount.value },
  { key: 'requests', label: 'Requests', count: requests.value.length },
])

const visibleLoqs = computed(() => (filter.value === 'paused'
  ? activeLoqs.value.filter(l => l.status === 'paused')
  : activeLoqs.value))

watch(() => visibleLoqs.value.length, () => nextTick(onStripScroll))

const subline = computed(() => {
  const n = activeLoqs.value.length
  const people = n === 0 ? 'No one is locked with you yet.' : `${n} ${n === 1 ? 'person is' : 'people are'} counting on you.`
  const waiting = attention.value.length
  if (!waiting) return people
  return `${people} ${waiting} ${waiting === 1 ? 'thing needs' : 'things need'} a decision.`
})

const nothingVisible = computed(() => (filter.value === 'requests' ? requests.value.length === 0 : visibleLoqs.value.length === 0))

const emptyStateTitle = computed(() => (
  filter.value === 'requests' ? 'No requests' : filter.value === 'paused' ? 'No paused locks' : 'No active locks'
))

// ─── Init ──────────────────────────────────────────────────────────────────

let clockTimer: ReturnType<typeof setInterval> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  if (import.meta.client) {
    window.addEventListener('online', handleReconnect)
    document.addEventListener('visibilitychange', onVisible)
    resizeObserver = new ResizeObserver(onStripScroll)
  }
  try {
    await Promise.all([fetchActiveLoqs(), fetchRequests(), fetchAttention()])
    subscribeToAll()
  }
  finally { initialising.value = false }
  // A shared link to a lock further along the strip: scroll it into view.
  if (selectedId.value) nextTick(() => revealCard(selectedId.value!))
  clockTimer = setInterval(() => { now.value = Date.now() }, 30_000)
  // Safety net for anything the realtime broadcasts miss.
  pollTimer = setInterval(() => { if (document.visibilityState === 'visible') refreshSignals() }, 60_000)
})

onUnmounted(() => {
  loqChannels.forEach(ch => ch.unsubscribe())
  loqChannels.clear()
  requestChannel?.unsubscribe()
  visitorInteractionChannel?.unsubscribe()
  if (clockTimer) clearInterval(clockTimer)
  if (pollTimer) clearInterval(pollTimer)
  if (signalsTimer) clearTimeout(signalsTimer)
  resizeObserver?.disconnect()
  if (import.meta.client) {
    window.removeEventListener('online', handleReconnect)
    document.removeEventListener('visibilitychange', onVisible)
  }
})

function onVisible() {
  if (document.visibilityState === 'visible') {
    now.value = Date.now()
    refreshSignals()
  }
}

async function handleReconnect() {
  loqChannels.forEach(ch => ch.unsubscribe())
  loqChannels.clear()
  requestChannel?.unsubscribe()
  requestChannel = null
  visitorInteractionChannel?.unsubscribe()
  visitorInteractionChannel = null
  subscribeToAll()
  refreshSignals()
}

function subscribeToAll() {
  activeLoqs.value.forEach(l => subscribeToLoq(l.id))
  subscribeToRequests()
  subscribeToVisitorInteractions()
}

// ─── Data fetch ────────────────────────────────────────────────────────────

async function fetchActiveLoqs() {
  try {
    activeLoqs.value = await authFetch<ActiveLoq[]>('/api/loqholders/active')
  }
  catch { activeLoqs.value = [] }
  syncChannels()
}

async function fetchRequests() {
  try {
    const res = await authFetch<{ data: IncomingRequest[] }>('/api/loqholders/incoming')
    requests.value = res.data ?? []
  }
  catch { requests.value = [] }
}

async function fetchAttention() {
  try {
    attention.value = (await authFetch<{ items: AttentionItem[] }>('/api/loqholders/attention')).items ?? []
  }
  catch { /* keep what is shown; the next refresh tries again */ }
}

// Signals and the feed change together (a photo arrives, a task is settled).
let signalsTimer: ReturnType<typeof setTimeout> | null = null
function refreshSignals() {
  if (signalsTimer) clearTimeout(signalsTimer)
  signalsTimer = setTimeout(() => {
    signalsTimer = null
    Promise.all([fetchActiveLoqs(), fetchAttention()])
  }, 250)
}

// ─── Realtime ──────────────────────────────────────────────────────────────

// Join new locks' channels and leave ended ones after a refetch.
function syncChannels() {
  if (initialising.value) return
  const ids = new Set(activeLoqs.value.map(l => l.id))
  activeLoqs.value.forEach(l => subscribeToLoq(l.id))
  ;[...loqChannels.keys()].forEach((id) => { if (!ids.has(id)) unsubscribeFromLoq(id) })
}

function subscribeToLoq(loqId: string) {
  if (loqChannels.has(loqId)) return
  const ch = $supabase
    .channel(`loq:${loqId}`)
    .on('broadcast', { event: 'loq_updated' }, (payload: { payload: { loq: Partial<ActiveLoq>; signals?: boolean } }) => {
      const { loq: updated, signals } = payload.payload
      // Issue #24 — a verification or task changed: reload what it affects.
      if (signals) { refreshSignals(); return }
      const idx = activeLoqs.value.findIndex(l => l.id === loqId)
      if (idx !== -1) activeLoqs.value[idx] = { ...activeLoqs.value[idx], ...updated }
    })
    .subscribe()
  loqChannels.set(loqId, ch)
}

function broadcastLoqUpdate(loqId: string, loqData: Partial<ActiveLoq>, loqholder?: { id: string; display_name: string | null; avatar_url: string | null } | null) {
  loqChannels.get(loqId)?.send({ type: 'broadcast', event: 'loq_updated', payload: { loq: loqData, loqholder } })
}

// Public visitor page has its own channel/topic (loq-public:{link}), kept
// separate from loq:{id} above so an anonymous visitor never receives the
// private payload (combination, reason, participant ids) that channel
// carries. Server-side REST broadcast doesn't actually deliver in this
// Supabase project (confirmed empirically) — join briefly and send
// directly instead, same as the private channel does.
function broadcastPublicUpdate(publicLinkId: string | null, payload: Record<string, unknown>) {
  if (!publicLinkId) return
  const ch = $supabase.channel(`loq-public:${publicLinkId}`)
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      ch.send({ type: 'broadcast', event: 'loq_updated', payload })
      setTimeout(() => ch.unsubscribe(), 500)
    }
  })
}

function unsubscribeFromLoq(loqId: string) {
  loqChannels.get(loqId)?.unsubscribe()
  loqChannels.delete(loqId)
}

function subscribeToRequests() {
  const userId = authStore.profile?.id
  if (!userId) return
  requestChannel = $supabase
    .channel(`lh:requests:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'loq_requests', filter: `loqholder_id=eq.${userId}` },
      // TASK-102 — this fires for both directions: someone requesting this
      // loqholder privately, AND this loqholder's own request-to-join
      // (TASK-087) getting approved/rejected by a loqee. The latter needs
      // activeLoqs refreshed too, or an approval never shows up in "Loqs"
      // without a manual reload.
      async () => { await Promise.all([fetchRequests(), fetchActiveLoqs(), fetchAttention()]) })
    .subscribe()
}

// TASK-065: flash "Visitor added/removed Xh" on the relevant loq card. The
// countdown itself already updates via the existing loq:{id} broadcast
// (adjust-time.post.ts calls broadcastLoqUpdate) — this only adds the
// notification on top.
function subscribeToVisitorInteractions() {
  const userId = authStore.profile?.id
  if (!userId) return
  visitorInteractionChannel = $supabase
    .channel(`lh:visitor-interactions:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'loq_visitor_interactions', filter: `loqholder_id=eq.${userId}` },
      (payload: { new: { loq_id: string; direction: 'add' | 'remove'; hours_added: number } }) => {
        const { loq_id, direction, hours_added } = payload.new
        flashMessage(loq_id, `Visitor ${direction === 'remove' ? 'removed' : 'added'} ${hours_added}h`)
      },
    )
    .subscribe()
}

// ─── Request actions ────────────────────────────────────────────────────────

async function acceptRequest(loqId: string) {
  pendingAction.value = loqId
  try {
    const loq = await acceptLoq(loqId) as ActiveLoq
    requests.value = requests.value.filter(r => r.loq.id !== loqId)
    subscribeToLoq(loq.id)
    broadcastLoqUpdate(loq.id, loq, authStore.profile)
    // The accept response has no signals or wearer profile; take the full row.
    await Promise.all([fetchActiveLoqs(), fetchAttention()])
  }
  catch (err: unknown) {
    setError(loqId, (err as Error).message)
  }
  finally { pendingAction.value = null }
}

async function rejectRequest(loqId: string) {
  pendingAction.value = loqId
  try {
    await rejectLoq(loqId)
    requests.value = requests.value.filter(r => r.loq.id !== loqId)
    attention.value = attention.value.filter(i => !(i.kind === 'request' && i.loq_id === loqId))
  }
  catch (err: unknown) { setError(loqId, (err as Error).message) }
  finally { pendingAction.value = null }
}

// ─── Active loq actions ────────────────────────────────────────────────────

async function togglePause(loqId: string) {
  setLoading(loqId)
  try {
    const updated = await pauseLoq(loqId)
    patchLoq(loqId, updated)
    broadcastLoqUpdate(loqId, updated)
    broadcastPublicUpdate(updated.public_link_id, {
      status: updated.status,
      loqed_until: updated.loqed_until,
      paused_at: updated.paused_at,
      locked: updated.locked,
    })
  }
  catch (err: unknown) { setError(loqId, (err as Error).message) }
  finally { clearLoading(loqId) }
}

async function adjustTime(loqId: string, deltaMinutes: number): Promise<boolean> {
  setLoading(loqId)
  try {
    const updated = await adjustLoqTime(loqId, deltaMinutes)
    patchLoq(loqId, updated)
    broadcastLoqUpdate(loqId, updated)
    broadcastPublicUpdate(updated.public_link_id, { loqed_until: updated.loqed_until })
    const span = spanMinutes(Math.abs(deltaMinutes))
    flashMessage(loqId, deltaMinutes > 0 ? `+${span} added` : `−${span} removed`)
    return true
  }
  catch (err: unknown) { setError(loqId, (err as Error).message); return false }
  finally { clearLoading(loqId) }
}

async function endLoq(loqId: string) {
  const ok = await confirm({
    title: 'End this lock?',
    message: 'Your wearer will be unlocked right away and the combination revealed to them. This can’t be undone.',
    confirmLabel: 'End lock',
    cancelLabel: 'Keep lock',
    danger: true,
  })
  if (!ok) return
  const publicLinkId = activeLoqs.value.find(l => l.id === loqId)?.public_link_id ?? null
  setLoading(loqId)
  try {
    await endLoqAction(loqId)
    broadcastLoqUpdate(loqId, { id: loqId, status: 'ended' } as Partial<ActiveLoq>)
    broadcastPublicUpdate(publicLinkId, { status: 'ended', locked: false })
    unsubscribeFromLoq(loqId)
    activeLoqs.value = activeLoqs.value.filter(l => l.id !== loqId)
    attention.value = attention.value.filter(i => i.loq_id !== loqId)
    if (selectedId.value === loqId) closeLock()
  }
  catch (err: unknown) { setError(loqId, (err as Error).message) }
  finally { clearLoading(loqId) }
}

async function onExpired(loqId: string) {
  await Promise.all([fetchActiveLoqs(), fetchAttention()])
  if (!activeLoqs.value.find(l => l.id === loqId) && selectedId.value === loqId) closeLock()
}

// ─── Per-loq loading helpers ───────────────────────────────────────────────

function isPending(id: string) { return pendingIds.value.has(id) }
function cardError(id: string) { return errorMap.value.get(id) ?? '' }
function cardFlash(id: string) { return flashMap.value.get(id) ?? '' }
function flashMessage(id: string, msg: string) {
  flashMap.value = new Map([...flashMap.value, [id, msg]])
  setTimeout(() => {
    const next = new Map(flashMap.value)
    next.delete(id)
    flashMap.value = next
  }, 2500)
}
function setLoading(id: string) {
  pendingIds.value = new Set([...pendingIds.value, id])
  const errors = new Map(errorMap.value)
  errors.delete(id)
  errorMap.value = errors
}
function clearLoading(id: string) { const s = new Set(pendingIds.value); s.delete(id); pendingIds.value = s }
function setError(id: string, msg: string) { errorMap.value = new Map([...errorMap.value, [id, msg]]) }
function patchLoq(id: string, patch: Partial<Loq>) {
  const idx = activeLoqs.value.findIndex(l => l.id === id)
  if (idx !== -1) activeLoqs.value[idx] = { ...activeLoqs.value[idx], ...patch }
}

// timeAgo / formatDuration / emotionEmoji come from composables/useLoqFormat.ts
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/lock-dashboard' as *;

// Wider than the shared .dash-body: the grid and the detail panel sit side by side.
.kh {
  flex: 1;
  width: 100%;
  max-width: 1360px;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 32px 20px 64px;
  display: flex;
  flex-direction: column;
  gap: 24px;

  @media (max-width: 639px) { padding: 20px 16px 48px; }

  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
  }

  &__title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(28px, 4vw, 36px);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--color-text);
  }

  &__sub { margin: 6px 0 0; font-size: 15px; color: var(--color-text-muted); }

  &__tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

  &__filter {
    display: flex;
    gap: 2px;
    padding: 4px;
    border-radius: 12px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    overflow-x: auto;
    max-width: 100%;
  }

  &__seg {
    flex-shrink: 0;
    min-height: 36px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--color-text-muted);
    font: 500 14px var(--font-sans);
    cursor: pointer;

    &:hover { color: var(--color-text); }
    &:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }

    &--on { background: var(--color-elevated); color: var(--color-text); font-weight: 600; }
  }

  &__seg-n { font-variant-numeric: tabular-nums; opacity: 0.8; }

  &__cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 18px;
    border-radius: 12px;
    background: var(--color-cta);
    color: var(--color-on-accent);
    font-weight: 700;
    text-decoration: none;
    &:hover { filter: brightness(1.06); color: var(--color-on-accent); text-decoration: none; }
    &:focus-visible { outline: 2px solid var(--color-text); outline-offset: 2px; }
  }

  &__requests {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }

  &__detail {
    min-width: 0;
    scroll-margin-top: 16px;
  }
}

// ── Lock strip: one row of cards, swipe or arrows ────────────────────────────

.kh-strip {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;

  &__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

  &__title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__n { font-size: 14px; font-weight: 500; color: var(--color-text-muted); }

  &__nav { display: flex; gap: 6px; }

  &__arrow {
    @include dash-btn;
    width: 44px;
    min-height: 44px;
    padding: 0;
  }

  &__track {
    list-style: none;
    margin: 0 -20px;
    padding: 4px 20px 12px;
    display: flex;
    gap: 16px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: 20px;
    scrollbar-width: thin;
    scrollbar-color: var(--color-elevated) transparent;

    &:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; border-radius: 12px; }

    @media (max-width: 639px) {
      margin: 0 -16px;
      padding-inline: 16px;
      scroll-padding-inline: 16px;
    }
  }

  &__item {
    flex: 0 0 320px;
    scroll-snap-align: start;
    display: flex;

    > * { flex: 1; min-width: 0; }

    // A phone shows one card and a sliver of the next, so it reads as swipeable.
    @media (max-width: 639px) { flex-basis: 84%; }
  }
}

// ── Request card ─────────────────────────────────────────────────────────────

.kh-req {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: 20px;
  background: linear-gradient(160deg, rgba(var(--color-warn-rgb), 0.06) 0%, var(--color-surface) 50%);
  border: 1px solid rgba(var(--color-warn-rgb), 0.3);

  &__who { display: flex; align-items: center; gap: 12px; }
  &__who > div { flex: 1; min-width: 0; }
  &__avatar { @include avatar(44px); }
  &__name { margin: 0; font-family: var(--font-display); font-size: 17px; font-weight: 600; color: var(--color-text); }
  &__meta { margin: 2px 0 0; font-size: 13px; color: var(--color-text-muted); }

  &__actions { display: flex; gap: 8px; }

  &__btn {
    @include dash-btn;
    flex: 1;
    min-height: 44px;
    color: var(--color-danger);
    border-color: rgba(var(--color-danger-rgb), 0.35);

    &--accept {
      flex: 2;
      background: var(--color-cta);
      border-color: var(--color-cta);
      color: var(--color-on-accent);
      &:hover:not(:disabled) { filter: brightness(1.06); }
    }
  }
}

// ── Empty state ──────────────────────────────────────────────────────────────

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.625rem;
  padding: 3rem 1rem;
  text-align: center;

  &__icon { font-size: 64px; margin: 0; }
  &__title { margin: 0; font-family: var(--font-display); font-size: 24px; font-weight: 700; color: var(--color-text); }
  &__hint { margin: 0; font-size: 16px; color: var(--color-text-muted); }
}
</style>
