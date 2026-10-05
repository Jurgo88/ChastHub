<template>
  <div class="stats-page">
    <AppNav />

    <main class="stats-wrap">
      <header class="shead">
        <div>
          <h1 class="shead__title">Stats</h1>
          <p class="shead__sub">What the community is up to, and who is leading.</p>
        </div>

        <button
          v-if="authStore.isAuthenticated"
          type="button"
          class="shead__vis"
          :disabled="optSaving"
          :aria-pressed="!optOut"
          @click="toggleOptOut"
        >
          <span>
            <strong>Show me in rankings</strong>
            <span>{{ optSaving ? 'Saving…' : optOut ? 'Hidden' : 'Visible' }}</span>
          </span>
          <span class="toggle" :class="{ 'toggle--on': !optOut }"><span class="toggle__knob" /></span>
        </button>
      </header>

      <!-- Community pulse -->
      <section class="pulse" aria-label="Community right now">
        <div class="pt pt--live">
          <span class="pt__live"><i />LIVE</span>
          <strong class="pt__v">{{ n(pulse?.locked_now) }}</strong>
          <span class="pt__l">Locked right now</span>
        </div>
        <div class="pt"><strong class="pt__v">{{ n(pulse?.hours_this_month) }}h</strong><span class="pt__l">Locked this month</span></div>
        <div class="pt"><strong class="pt__v">{{ n(pulse?.done_this_week) }}</strong><span class="pt__l">Locks done this week</span></div>
        <div class="pt pt--wide-hide"><strong class="pt__v">{{ n(pulse?.keyholders_active) }}</strong><span class="pt__l">Keyholders active</span></div>
        <NuxtLink to="/keydrop" class="pt pt--wide-hide pt--link"><strong class="pt__v">{{ n(pulse?.keydrop_waiting) }}</strong><span class="pt__l">Waiting in Key Drop</span></NuxtLink>
      </section>

      <nav class="stabs" aria-label="Rankings">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="stabs__tab"
          :class="{ 'stabs__tab--on': tab === t.key }"
          @click="setTab(t.key)"
        >
          {{ t.label }}<span v-if="t.key === 'locktober'" class="stabs__live">LIVE</span>
        </button>
      </nav>

      <div class="sgrid">
        <div class="sgrid__main">
          <StatsLocktoberCard v-if="tab === 'locktober' && pulse" :locktober="pulse.locktober" class="sgrid__lt" />

          <StatsBoard :board="board" :rows="boardData?.rows ?? []" :me="myRow" :loading="boardLoading" :error="boardError" @retry="loadBoard">
            <template #bar>
              <div class="sbar">
                <div class="sbar__chips" role="tablist">
                  <button
                    v-for="b in currentBoards"
                    :key="b"
                    type="button"
                    role="tab"
                    class="chip"
                    :class="{ 'chip--on': board === b }"
                    :aria-selected="board === b"
                    @click="setBoard(b)"
                  >
                    {{ boardLabel(b) }}
                  </button>
                </div>
                <div v-if="showPeriods" class="seg" role="radiogroup" aria-label="Period">
                  <button
                    v-for="p in periods"
                    :key="p"
                    type="button"
                    role="radio"
                    :aria-checked="period === p"
                    :class="{ on: period === p }"
                    @click="setPeriod(p)"
                  >
                    {{ periodLabel(p, pulse?.locktober.year ?? new Date().getFullYear()) }}
                  </button>
                </div>
              </div>
            </template>
          </StatsBoard>
        </div>

        <aside class="sgrid__side">
          <StatsYourStats v-if="authStore.isAuthenticated" :data="me" :loading="meLoading" />
          <section v-else class="join">
            <h3>Where would you rank?</h3>
            <p>Create an account to get your own place on the boards.</p>
            <NuxtLink to="/auth/signup" class="pbtn pbtn--primary">Join ChastHub</NuxtLink>
          </section>

          <section v-if="tab !== 'crowd' && crowd.length" class="crowd">
            <h3>Crowd favorites</h3>
            <p>Most time added by visitors this month.</p>
            <ul>
              <li v-for="c in crowd" :key="c.id">
                <UserAvatar class="crowd__avatar" :avatar-url="c.avatar_url" :display-name="c.display_name" />
                <NuxtLink v-if="c.username" :to="`/user/${c.username}`" class="crowd__name">{{ c.display_name }}</NuxtLink>
                <span v-else class="crowd__name">{{ c.display_name }}</span>
                <strong>{{ formatBoardValue('crowd', c.value) }}</strong>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { StatsBoard as Board, StatsBoardKey, StatsMe, StatsMeRow, StatsPeriod, StatsPulse, StatsRow } from '~/types'
import { BOARD_META, formatBoardValue, periodLabel } from '~/utils/statsBoards'

// TASK-119 carried over from /leaderboard: the rows load client-side and the
// page is noindex, so pseudonymous names never become searchable.
useSeoMeta({
  robots: 'noindex, follow',
  title: 'Stats',
  description: 'Community stats on ChastHub: who is locked right now, the longest locks, the busiest keyholders, and the Locktober survivors.',
  ogTitle: 'ChastHub Stats',
  ogDescription: 'Who is locked right now, the longest locks and the Locktober survivors.',
})

type Tab = 'locktober' | 'wearers' | 'keyholders' | 'crowd'

const TAB_BOARDS: Record<Tab, StatsBoardKey[]> = {
  locktober: ['locktober_survivors', 'locktober_30', 'wearer_total', 'crowd'],
  wearers: ['wearer_longest', 'wearer_total', 'wearer_completed', 'wearer_running'],
  keyholders: ['keyholder_locks', 'keyholder_hours', 'keyholder_wearers', 'keyholder_holding'],
  crowd: ['crowd'],
}

const authStore = useAuthStore()
const { authFetch } = useAuthFetch()
const route = useRoute()
const router = useRouter()

const pulse = ref<StatsPulse | null>(null)
const boardData = ref<Board | null>(null)
const boardLoading = ref(true)
const boardError = ref('')
const me = ref<StatsMe | null>(null)
const meLoading = ref(false)
const crowd = ref<StatsRow[]>([])

// The Locktober tab stays up through November while Locktober 30 finishes.
const l30 = computed(() => pulse.value?.locktober.l30 ?? null)
const locktoberLive = computed(() => !!pulse.value?.locktober.active || !!l30.value?.active)

const tabs = computed(() => [
  ...(locktoberLive.value ? [{ key: 'locktober' as Tab, label: `Locktober ${pulse.value!.locktober.year}` }] : []),
  { key: 'wearers' as Tab, label: 'Wearers' },
  { key: 'keyholders' as Tab, label: 'Keyholders' },
  { key: 'crowd' as Tab, label: 'Crowd favorites' },
])

const tab = ref<Tab>('wearers')
const board = ref<StatsBoardKey>('wearer_longest')
const period = ref<StatsPeriod>('all')

const currentBoards = computed(() => TAB_BOARDS[tab.value].filter((b) => {
  if (b === 'locktober_survivors') return !!pulse.value?.locktober.active
  if (b === 'locktober_30') return !!l30.value?.active
  if (tab.value === 'locktober' && (b === 'wearer_total' || b === 'crowd')) return !!pulse.value?.locktober.active
  return true
}))
const showPeriods = computed(() => tab.value !== 'locktober' && !BOARD_META[board.value].periodless)
// Locktober as a period only makes sense once there has been one.
const periods = computed<StatsPeriod[]>(() => ['all', 'month', 'locktober'])

// On the Locktober tab every board is scoped to Locktober.
const effectivePeriod = computed<StatsPeriod>(() => tab.value === 'locktober' ? 'locktober' : period.value)

function currentBoardsFor(t: Tab) {
  const prev = tab.value
  if (prev === t) return currentBoards.value
  return TAB_BOARDS[t].filter((b) => {
    if (b === 'locktober_survivors') return !!pulse.value?.locktober.active
    if (b === 'locktober_30') return !!l30.value?.active
    if (t === 'locktober' && (b === 'wearer_total' || b === 'crowd')) return !!pulse.value?.locktober.active
    return true
  })
}

function boardLabel(b: StatsBoardKey) {
  if (tab.value === 'locktober' && b === 'wearer_total') return 'Most time'
  return BOARD_META[b].label
}

function n(v: number | undefined) {
  return v === undefined ? '–' : Math.round(v).toLocaleString('en-US')
}

// Your row on the board being shown, from /api/stats/me when it matches.
const myRow = computed<StatsMeRow | null>(() => {
  if (!me.value || me.value.hidden) return null
  if (effectivePeriod.value !== meFor.value) return null
  return me.value.boards[board.value]?.me ?? null
})
const meFor = ref<StatsPeriod | null>(null)

function syncUrl() {
  router.replace({ query: { tab: tab.value, board: board.value, period: period.value === 'all' ? undefined : period.value } })
}

function setTab(t: Tab) {
  if (tab.value === t) return
  tab.value = t
  board.value = (TAB_BOARDS[t].find(b => currentBoardsFor(t).includes(b)) ?? TAB_BOARDS[t][0])!
  syncUrl()
  loadBoard()
  loadMe()
}

function setBoard(b: StatsBoardKey) {
  if (board.value === b) return
  board.value = b
  syncUrl()
  loadBoard()
}

function setPeriod(p: StatsPeriod) {
  if (period.value === p) return
  period.value = p
  syncUrl()
  loadBoard()
  loadMe()
}

let boardSeq = 0
async function loadBoard() {
  const seq = ++boardSeq
  boardLoading.value = true
  boardError.value = ''
  try {
    const p = BOARD_META[board.value].periodless ? 'all' : effectivePeriod.value
    const data = await $fetch<Board>('/api/stats/board', { params: { board: board.value, period: p, limit: 25 } })
    if (seq === boardSeq) boardData.value = data
  }
  catch {
    if (seq === boardSeq) boardError.value = 'Could not load this ranking.'
  }
  finally {
    if (seq === boardSeq) boardLoading.value = false
  }
}

async function loadMe() {
  if (!authStore.isAuthenticated) return
  const p = effectivePeriod.value
  if (meFor.value === p && me.value) return
  meLoading.value = !me.value
  try {
    me.value = await authFetch<StatsMe>('/api/stats/me', { params: { period: p } })
    meFor.value = p
  }
  catch { /* the card shows its empty state */ }
  finally {
    meLoading.value = false
  }
}

async function loadCrowd() {
  try {
    const data = await $fetch<Board>('/api/stats/board', { params: { board: 'crowd', period: 'month', limit: 3 } })
    crowd.value = data.rows
  }
  catch { crowd.value = [] }
}

onMounted(async () => {
  try { pulse.value = await $fetch<StatsPulse>('/api/stats/pulse') }
  catch { /* tiles show dashes */ }

  // Tab from the URL if valid, else Locktober while it runs, else the
  // board for your own role.
  const q = route.query
  const wanted = String(q.tab ?? '') as Tab
  const valid = tabs.value.some(t => t.key === wanted)
  tab.value = valid ? wanted : locktoberLive.value ? 'locktober' : authStore.profile?.role === 'loqholder' ? 'keyholders' : 'wearers'
  const qb = String(q.board ?? '') as StatsBoardKey
  board.value = currentBoards.value.includes(qb) ? qb : (currentBoards.value[0] ?? TAB_BOARDS[tab.value][0])!
  const qp = String(q.period ?? '') as StatsPeriod
  period.value = ['all', 'month', 'locktober'].includes(qp) ? qp : 'all'

  loadBoard()
  loadMe()
  loadCrowd()
})

// ── Show me in rankings ──────────────────────────────────────────────────────
const optOut = ref(authStore.profile?.leaderboard_opt_out ?? false)
const optSaving = ref(false)

async function toggleOptOut() {
  optOut.value = !optOut.value
  optSaving.value = true
  try {
    await authFetch('/api/profile/leaderboard-opt-out', { method: 'POST', body: { opt_out: optOut.value } })
    if (authStore.profile) authStore.setProfile({ ...authStore.profile, leaderboard_opt_out: optOut.value })
    meFor.value = null
    await Promise.all([loadMe(), loadBoard()])
  }
  catch {
    optOut.value = !optOut.value
  }
  finally {
    optSaving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/shared-ui' as *;
@use '~/assets/styles/profile' as *;

.stats-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(900px 500px at 85% -120px, rgba(var(--color-brand-rgb), 0.14) 0%, rgba(var(--color-brand-rgb), 0) 70%),
    var(--color-bg);
}

.stats-wrap {
  width: 100%;
  max-width: 1180px;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 28px 20px 72px;
}

.shead {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  flex-wrap: wrap;

  &__title { margin: 0; font: 700 clamp(32px, 5vw, 44px) var(--font-display); letter-spacing: -0.03em; line-height: 1; }
  &__sub { margin: 8px 0 0; color: var(--color-text-muted); font-size: 16px; }

  &__vis {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 14px;
    border-radius: 14px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    font: 13px var(--font-sans);
    text-align: left;
    cursor: pointer;

    &:disabled { cursor: wait; }

    strong { display: block; font-size: 14px; }
    span > span { color: var(--color-text-muted); }
  }
}

// ── Pulse ────────────────────────────────────────────────────────────────────

.pulse {
  display: grid;
  grid-template-columns: 1.3fr repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 22px;
}

.pt {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 16px 18px;
  border-radius: 18px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  text-decoration: none;

  &__v { font: 700 28px var(--font-display); font-variant-numeric: tabular-nums; }
  &__l { margin-top: 4px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-muted); }

  &--live {
    background: linear-gradient(135deg, rgba(var(--color-brand-rgb), 0.28), rgba(79, 23, 135, 0.5));
    border-color: rgba(var(--color-accent-rgb), 0.45);

    .pt__v { font-size: 36px; }
  }

  &__live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--color-accent);

    i {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--color-accent);
      box-shadow: 0 0 8px var(--color-accent);
      animation: live 2s ease-in-out infinite;
    }
  }

  &--link:hover { border-color: var(--color-accent); text-decoration: none; }
}

@keyframes live { 50% { opacity: 0.35; } }

// ── Tabs ─────────────────────────────────────────────────────────────────────

.stabs {
  display: flex;
  gap: 6px;
  margin: 30px 0 18px;
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
  scrollbar-width: none;

  &__tab {
    padding: 12px 16px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--color-text-muted);
    font: 600 15px var(--font-sans);
    white-space: nowrap;
    cursor: pointer;

    &:hover { color: var(--color-text); }

    &--on { color: var(--color-text); border-bottom-color: var(--color-brand); }
  }

  &__live {
    margin-left: 6px;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    vertical-align: 1px;
  }
}

// ── Layout ───────────────────────────────────────────────────────────────────

.sgrid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 22px;
  align-items: start;

  &__main { display: flex; flex-direction: column; gap: 22px; min-width: 0; }

  &__side {
    display: flex;
    flex-direction: column;
    gap: 18px;
    position: sticky;
    top: 20px;
  }
}

.sbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;

  &__chips { display: flex; gap: 8px; flex-wrap: wrap; }
}

.chip {
  padding: 8px 13px;
  border-radius: 999px;
  border: 1.5px solid var(--color-border);
  background: none;
  color: #CFC5F2;
  font: 600 13px var(--font-sans);
  cursor: pointer;

  &:hover { border-color: var(--color-elevated); }

  &--on {
    border-color: var(--color-brand);
    background: rgba(var(--color-brand-rgb), 0.14);
    color: var(--color-text);
  }
}

.seg {
  display: flex;
  padding: 3px;
  border-radius: 999px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);

  button {
    padding: 6px 12px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--color-text-muted);
    font: 600 12px var(--font-sans);
    white-space: nowrap;
    cursor: pointer;

    &.on { background: var(--color-elevated); color: var(--color-text); }
  }
}

.join, .crowd {
  border-radius: 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 22px;

  h3 { margin: 0; font: 700 18px var(--font-display); }
  p { margin: 4px 0 16px; font-size: 13px; color: var(--color-text-muted); }
}

.crowd {
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }

  li {
    display: flex;
    align-items: center;
    gap: 10px;


    strong { font: 700 14px var(--font-display); color: var(--color-cta); }
  }

  &__avatar { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; }

  &__name { flex: 1; min-width: 0; font-weight: 600; font-size: 14px; color: var(--color-text); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

@media (max-width: 980px) {
  .sgrid { grid-template-columns: minmax(0, 1fr); }
  .sgrid__side { position: static; }
  .pulse { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .pt--live { grid-column: 1 / -1; }
}

@media (max-width: 600px) {
  .stats-wrap { padding: 20px 14px 56px; }
  .pulse { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .pt { padding: 12px 14px; border-radius: 16px; }
  .pt__v { font-size: 22px; }
  .pt--live .pt__v { font-size: 30px; }
  .pt--wide-hide { display: none; }
  .stabs { margin: 22px 0 14px; }
  .stabs__tab { padding: 10px 10px; font-size: 14px; }
  .sbar { padding: 14px; }
}
</style>
