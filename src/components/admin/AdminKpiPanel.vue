<template>
  <section class="kpi-panel">
    <div class="admin-section-header kpi-panel__header">
      <h2>Product</h2>
      <span v-if="kpi" class="text-muted">
        since launch {{ formatDate(kpi.launch) }} ·
        <template v-if="kpi.tracking_since">exact activity from {{ formatDate(kpi.tracking_since) }}</template>
        <template v-else>exact activity tracking starts with the next app open</template>
      </span>
    </div>

    <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>

    <div v-else-if="error" class="admin-error">⚠️ {{ error }}</div>

    <template v-else-if="kpi">
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-card__label">Active today</span>
          <span class="kpi-card__value">{{ today?.dau ?? 0 }}</span>
          <span class="kpi-card__sub">{{ yesterday?.dau ?? 0 }} yesterday · {{ avg7 }} a day over 7 days</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">D1 retention</span>
          <span class="kpi-card__value">{{ pct(kpi.retention.d1_returned, kpi.retention.d1_base) }}</span>
          <span class="kpi-card__sub">
            {{ kpi.retention.d1_returned }} of {{ kpi.retention.d1_base }} back the next day
            · last 30 days {{ pct(kpi.retention.recent_d1_returned, kpi.retention.recent_d1_base) }}
          </span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">D3 retention</span>
          <span class="kpi-card__value">{{ pct(kpi.retention.d3_returned, kpi.retention.d3_base) }}</span>
          <span class="kpi-card__sub">
            {{ kpi.retention.d3_returned }} of {{ kpi.retention.d3_base }} back on day 3
            · any of days 1–3 {{ pct(kpi.retention.d1_3_returned, kpi.retention.d3_base) }}
          </span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">New subscribers · 24 h</span>
          <span class="kpi-card__value">{{ kpi.subscribers.new_24h }}</span>
          <span class="kpi-card__sub">
            {{ kpi.subscribers.first_payment_24h }} first payments · {{ kpi.subscribers.active_total }} paying in total
          </span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">App opens per user · 30 d</span>
          <span class="kpi-card__value">{{ eng.active_users ? ratio(eng.sessions, eng.active_users) : '–' }}</span>
          <span class="kpi-card__sub">
            <template v-if="eng.active_users">
              on {{ ratio(eng.active_user_days, eng.active_users) }} days each · {{ eng.active_users }} active users
            </template>
            <template v-else>collecting from the next app open</template>
          </span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">Used a lock</span>
          <span class="kpi-card__value">{{ pct(kpi.funnel.in_accepted_loq, kpi.funnel.registered) }}</span>
          <span class="kpi-card__sub">
            {{ kpi.funnel.in_accepted_loq }} of {{ kpi.funnel.registered }} were in an accepted lock
          </span>
        </div>
      </div>

      <!-- Daily active users — one series, so the heading names it and there
           is no legend. The table below carries every value. -->
      <div class="kpi-block">
        <div class="kpi-block__head">
          <h3 class="kpi-block__title">Daily active users</h3>
          <!-- TASK-180 — two series, so a legend; together they make the day's total. -->
          <ul class="legend" aria-label="Legend">
            <li><span class="legend__key legend__key--returning" />Returning</li>
            <li><span class="legend__key legend__key--new" />New — signed up that day</li>
          </ul>
        </div>
        <div class="dau-chart" @mouseleave="hover = null">
          <div class="dau-chart__axis">
            <span v-for="t in yTicks" :key="t" :style="{ bottom: `${(t / yMax) * 100}%` }">{{ t }}</span>
          </div>
          <div class="dau-chart__plot">
            <div
              v-for="t in yTicks"
              :key="`g${t}`"
              class="dau-chart__grid"
              :style="{ bottom: `${(t / yMax) * 100}%` }"
            />
            <div
              v-if="trackingIndex > 0"
              class="dau-chart__marker"
              :style="{ left: `${(trackingIndex / kpi.daily.length) * 100}%` }"
            >
              <span>exact from here</span>
            </div>
            <div class="dau-chart__bars">
              <div
                v-for="(d, i) in kpi.daily"
                :key="d.d"
                class="dau-chart__slot"
                @mouseenter="hover = i"
              >
                <!-- TASK-180 — returning at the base, new on top; the whole
                     column is the day's active total. -->
                <div
                  class="dau-chart__bar"
                  :class="{ 'dau-chart__bar--active': hover === i }"
                  :style="{ height: `${(d.dau / yMax) * 100}%` }"
                >
                  <span
                    v-if="newUsers(d)"
                    class="dau-chart__seg dau-chart__seg--new"
                    :style="{ flexGrow: newUsers(d) }"
                  />
                  <span
                    v-if="d.returning_users"
                    class="dau-chart__seg dau-chart__seg--returning"
                    :style="{ flexGrow: d.returning_users }"
                  />
                </div>
              </div>
            </div>
            <div
              v-if="hover !== null && kpi.daily[hover]"
              class="dau-chart__tip"
              :class="{ 'dau-chart__tip--left': hover > kpi.daily.length / 2 }"
              :style="{ left: `${((hover + 0.5) / kpi.daily.length) * 100}%` }"
            >
              <strong>{{ formatDay(kpi.daily[hover].d) }}</strong>
              <span class="dau-chart__tip-total">{{ kpi.daily[hover].dau }} active</span>
              <span><i class="legend__key legend__key--returning" />{{ kpi.daily[hover].returning_users }} returning</span>
              <span><i class="legend__key legend__key--new" />{{ newUsers(kpi.daily[hover]) }} new</span>
              <span v-if="kpi.daily[hover].tracked_users">{{ kpi.daily[hover].sessions }} app opens</span>
            </div>
          </div>
          <div class="dau-chart__x">
            <span>{{ formatDate(kpi.daily[0]?.d) }}</span>
            <span>{{ formatDate(kpi.daily[kpi.daily.length - 1]?.d) }}</span>
          </div>
        </div>
        <p class="kpi-note">
          Before exact tracking a user counts as active on a day only if they did something — signed up,
          made or accepted a lock, sent a message, voted<template v-if="!kpi.audit_log_active">
          (the auth log adds no logins here)</template>. Days before that line read low.
        </p>

        <details class="kpi-table">
          <summary>Show every day</summary>
          <!-- TASK-180 — headers aligned with their numbers (both right), a
               bounded width so the columns stay together, and the chart's
               colour keys on the two series. -->
          <table class="admin-table admin-table--compact daily">
            <thead>
              <tr>
                <th>Day</th>
                <th class="num">Active</th>
                <th class="num"><span class="legend__key legend__key--returning" />Returning</th>
                <th class="num"><span class="legend__key legend__key--new" />New</th>
                <th class="num">App opens</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in [...kpi.daily].reverse()" :key="d.d">
                <td>{{ formatDay(d.d) }}</td>
                <td class="num">{{ d.dau }}</td>
                <td class="num">{{ d.returning_users }}</td>
                <td class="num">{{ newUsers(d) }}</td>
                <td class="num">{{ d.tracked_users ? d.sessions : '–' }}</td>
              </tr>
            </tbody>
          </table>
        </details>
      </div>

      <div class="kpi-columns">
        <div class="kpi-block">
          <h3 class="kpi-block__title">Lock usage · share of {{ kpi.funnel.registered }} registered</h3>
          <div v-for="row in funnelRows" :key="row.label" class="hbar">
            <span class="hbar__label">{{ row.label }}</span>
            <div class="hbar__track">
              <div class="hbar__fill" :style="{ width: `${share(row.value, kpi.funnel.registered)}%` }" />
            </div>
            <span class="hbar__value">{{ row.value }} · {{ pct(row.value, kpi.funnel.registered) }}</span>
          </div>
        </div>

        <div class="kpi-block">
          <h3 class="kpi-block__title">Where they signed up from</h3>
          <!-- TASK-183 — every country, paged; no "Other" hiding the tail. -->
          <div v-for="row in pagedCountryRows" :key="row.label" class="hbar hbar--ranked">
            <span class="hbar__rank">{{ row.muted ? '' : `#${row.rank}` }}</span>
            <span class="hbar__label" :class="{ 'hbar__label--muted': row.muted }">{{ row.label }}</span>
            <div class="hbar__track">
              <div class="hbar__fill" :style="{ width: `${share(row.value, countryMax)}%` }" />
            </div>
            <span class="hbar__value">{{ row.value }} · {{ pct(row.value, kpi.users) }}</span>
          </div>
          <div v-if="countryRows.length > COUNTRY_PAGE" class="pager">
            <button class="pager__btn" :disabled="countryPage === 0" aria-label="Previous countries" @click="countryPage--">‹</button>
            <span class="pager__pos">
              {{ countryPage * COUNTRY_PAGE + 1 }}–{{ Math.min((countryPage + 1) * COUNTRY_PAGE, countryRows.length) }}
              of {{ countryRows.length }}
            </span>
            <button class="pager__btn" :disabled="(countryPage + 1) * COUNTRY_PAGE >= countryRows.length" aria-label="Next countries" @click="countryPage++">›</button>
          </div>
          <p class="kpi-note">Country at signup.</p>
        </div>

        <!-- TASK-165 — absent until migration 068; the rest of the panel
             does not depend on it. -->
        <div v-if="kpi.sources" class="kpi-block">
          <h3 class="kpi-block__title">How they found us</h3>
          <template v-if="kpi.sources.signups">
            <div v-for="row in sourceRows" :key="row.label" class="hbar">
              <span class="hbar__label" :class="{ 'hbar__label--muted': row.muted }">{{ row.label }}</span>
              <div class="hbar__track">
                <div class="hbar__fill" :style="{ width: `${share(row.value, sourceMax)}%` }" />
              </div>
              <span class="hbar__value">{{ row.value }} · {{ pct(row.value, kpi.sources.signups) }}</span>
            </div>
            <template v-if="kpi.sources.campaigns.length">
              <h4 class="kpi-block__subtitle">Campaign links</h4>
              <table class="admin-table admin-table--compact kpi-campaigns">
                <thead><tr><th>Source</th><th>Medium</th><th>Campaign</th><th class="num">Signups</th></tr></thead>
                <tbody>
                  <tr v-for="(c, i) in kpi.sources.campaigns" :key="i">
                    <td>{{ c.source ?? '–' }}</td>
                    <td>{{ c.medium ?? '–' }}</td>
                    <td>{{ c.campaign ?? '–' }}</td>
                    <td class="num">{{ c.users }}</td>
                  </tr>
                </tbody>
              </table>
            </template>
            <p class="kpi-note">
              {{ kpi.sources.signups }} signups since {{ formatDate(kpi.sources.since) }}, when sources started being
              recorded. "No source" is someone who typed the address, or came from an app that does not pass a referrer.
            </p>
          </template>
          <p v-else class="kpi-note">
            Nothing recorded yet — the source is saved from the next signup on.
          </p>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
interface KpiDay {
  d: string
  dau: number
  returning_users: number
  signups: number
  tracked_users: number
  sessions: number
}

interface Kpi {
  launch: string
  tracking_since: string | null
  audit_log_active: boolean
  users: number
  daily: KpiDay[]
  retention: Record<
    'd1_base' | 'd1_returned' | 'd3_base' | 'd3_returned' | 'd1_3_returned'
    | 'recent_d1_base' | 'recent_d1_returned' | 'recent_d3_base' | 'recent_d3_returned', number>
  funnel: Record<'registered' | 'created_loq' | 'published_loq' | 'loqholder_requested' | 'in_accepted_loq' | 'voted', number>
  subscribers: Record<'new_24h' | 'new_24h_active' | 'first_payment_24h' | 'active_total', number>
  engagement_30d: { active_users: number; active_user_days: number; sessions: number }
  countries: { country: string; users: number }[]
  // TASK-165 — null until migration 068 is applied.
  sources: {
    since: string | null
    signups: number
    no_source: number
    referrers: { referrer: string; users: number }[]
    campaigns: { source: string | null; medium: string | null; campaign: string | null; users: number }[]
  } | null
}

const { authFetch } = useAuthFetch()

const kpi = ref<Kpi | null>(null)
const loading = ref(true)
const error = ref('')
const hover = ref<number | null>(null)

const today = computed(() => kpi.value?.daily.at(-1))
const yesterday = computed(() => kpi.value?.daily.at(-2))
const eng = computed(() => kpi.value?.engagement_30d ?? { active_users: 0, active_user_days: 0, sessions: 0 })

// Today is still running, so the average is over the 7 full days before it.
const avg7 = computed(() => {
  const days = kpi.value?.daily.slice(-8, -1) ?? []
  if (!days.length) return 0
  return Math.round(days.reduce((s, d) => s + d.dau, 0) / days.length)
})

// Round the axis up to a clean step so the ticks read as round numbers.
// TASK-180 — finer steps than 1 / 2 / 5: a peak of 270 used to get a 500
// axis, half of it empty. A mid tick that would not be whole is dropped.
const yMax = computed(() => {
  const max = Math.max(1, ...(kpi.value?.daily.map(d => d.dau) ?? [0]))
  const mag = 10 ** Math.floor(Math.log10(max))
  return ([1, 2, 3, 4, 5, 6, 8, 10].map(m => m * mag).find(v => v >= max)) ?? max
})
const yTicks = computed(() => [0, yMax.value / 2, yMax.value].filter((t, i) => i !== 1 || Number.isInteger(t)))

const trackingIndex = computed(() => {
  const since = kpi.value?.tracking_since
  return since ? kpi.value!.daily.findIndex(d => d.d === since) : -1
})

const funnelRows = computed(() => {
  const f = kpi.value!.funnel
  return [
    { label: 'Created a lock', value: f.created_loq },
    { label: 'Published a lock', value: f.published_loq },
    { label: 'Keyholder sent a request', value: f.loqholder_requested },
    { label: 'In an accepted lock', value: f.in_accepted_loq },
    { label: 'Voted on a public lock', value: f.voted },
  ]
})

// TASK-183 — every country, paged, largest first. "Not recorded" (accounts
// from before TASK-137 captured it) is missing data, not a country: it goes
// last and muted, unranked.
const COUNTRY_PAGE = 8
const countryPage = ref(0)
const countryRows = computed(() => {
  const known = kpi.value!.countries.filter(c => c.country)
  const unknown = kpi.value!.countries.find(c => !c.country)
  const rows: { label: string; value: number; rank: number; muted?: boolean }[] = known
    .map((c, i) => ({ label: countryName(c.country), value: c.users, rank: i + 1 }))
  if (unknown) rows.push({ label: 'Not recorded', value: unknown.users, rank: 0, muted: true })
  return rows
})
const pagedCountryRows = computed(() =>
  countryRows.value.slice(countryPage.value * COUNTRY_PAGE, (countryPage.value + 1) * COUNTRY_PAGE))
// Scaled to the overall top country, so a bar means the same on every page.
const countryMax = computed(() => Math.max(1, ...countryRows.value.map(r => r.value)))

// Top 8 referring sites, the rest as Other, and "No source" last — it is the
// answer to a different question (typed in, or an app without a referrer).
const sourceRows = computed(() => {
  const s = kpi.value?.sources
  if (!s) return []
  const rows: { label: string; value: number; muted?: boolean }[] = s.referrers.map(r => ({ label: r.referrer, value: r.users }))
  const top = rows.length > 9
    ? [...rows.slice(0, 8), { label: 'Other sites', value: rows.slice(8).reduce((n, r) => n + r.value, 0) }]
    : rows
  const tagged = s.signups - s.no_source - s.referrers.reduce((n, r) => n + r.users, 0)
  if (tagged > 0) top.push({ label: 'Campaign link, no referrer', value: tagged, muted: true })
  if (s.no_source) top.push({ label: 'No source', value: s.no_source, muted: true })
  return top
})
const sourceMax = computed(() => Math.max(1, ...sourceRows.value.map(r => r.value)))

const regionNames = import.meta.client ? new Intl.DisplayNames(['en'], { type: 'region' }) : null
function countryName(code: string) {
  try { return regionNames?.of(code) ?? code }
  catch { return code }
}

// TASK-180 — signing up counts as that day's activity, so active = returning
// + new. Derived rather than read from `signups`, so the two segments always
// add up to the bar even if the definitions drift.
function newUsers(d: KpiDay) {
  return Math.max(0, d.dau - d.returning_users)
}

// "Sat 26 Sept" — the weekday makes weekly patterns readable in the table.
function formatDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function share(n: number, of: number) {
  return of ? Math.max(0, Math.min(100, (n / of) * 100)) : 0
}
function pct(n: number, of: number) {
  return of ? `${Math.round((n / of) * 100)}%` : '–'
}
function ratio(n: number, of: number) {
  return of ? (n / of).toFixed(1) : '–'
}
function formatDate(iso: string | null | undefined) {
  if (!iso) return '–'
  // Plain dates from Postgres — parse as local midnight, not UTC.
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

onMounted(async () => {
  try {
    kpi.value = await authFetch<Kpi>('/api/admin/kpi')
  }
  catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to load KPIs.'
  }
  finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use '~/pages/admin/admin-shared';

.kpi-panel {
  margin-top: 1rem;

  &__header {
    flex-wrap: wrap;
    gap: 0.5rem 1rem;

    h2 {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--color-text);
      margin: 0;
    }
  }
}

// TASK-180 — the chart's two series. Validated as a pair on the dark admin
// surface (#242424): CVD ΔE ≥ 31, normal-vision ΔE 33, both ≥ 3:1 contrast.
.kpi-panel {
  --series-returning: #6d6ffb;
  --series-new: #d95926;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.8rem;
  color: var(--color-text-muted);

  li { display: inline-flex; align-items: center; }

  &__key {
    display: inline-block;
    width: 0.65rem;
    height: 0.65rem;
    margin-right: 0.4rem;
    border-radius: 2px;
    vertical-align: -1px;

    &--returning { background: var(--series-returning); }
    &--new { background: var(--series-new); }
  }
}

.kpi-block {
  margin-top: 1.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  padding: 1.25rem;
  min-width: 0;

  &__head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    margin-bottom: 1rem;

    .kpi-block__title { margin: 0; }
  }

  &__title {
    margin: 0 0 1rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text);
  }

  &__subtitle {
    margin: 1.25rem 0 0.25rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-muted);
  }
}

.kpi-campaigns {
  font-size: 0.85rem;

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
}

// Six tiles: wide enough that they break 3 + 3 rather than 5 + 1. The min()
// keeps every track from outgrowing a narrow screen.
.kpi-grid {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
}

.kpi-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 0 1rem;
}

.kpi-note {
  margin: 0.75rem 0 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

// ── DAU columns ──────────────────────────────────────────────────────────
.dau-chart {
  display: grid;
  grid-template-columns: 2.25rem 1fr;
  grid-template-rows: 180px auto;

  &__axis {
    position: relative;

    span {
      position: absolute;
      right: 0.5rem;
      transform: translateY(50%);
      font-size: 0.75rem;
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
    }
  }

  &__plot {
    position: relative;
    border-bottom: 1px solid var(--color-border);
  }

  // Hairline, solid, one step off the surface — recessive.
  &__grid {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px solid var(--color-border);
  }

  &__marker {
    position: absolute;
    top: 0;
    bottom: 0;
    border-left: 1px solid var(--color-text-muted);

    span {
      position: absolute;
      top: -0.1rem;
      left: 0.3rem;
      font-size: 0.7rem;
      color: var(--color-text-muted);
      white-space: nowrap;
    }
  }

  &__bars {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    // 2px of surface between neighbours: the gap, not a stroke, separates them.
    gap: 2px;
  }

  // The whole column is the hover target, not just the bar.
  &__slot {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    min-width: 0;
  }

  // A column of two segments. The 2px gap is surface, not a stroke; only
  // the top segment's data-end is rounded.
  &__bar {
    width: 100%;
    max-width: 24px;
    min-height: 1px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    opacity: 0.85;

    &--active { opacity: 1; }
  }

  &__seg {
    flex-basis: 0;
    min-height: 1px;

    &:first-child { border-radius: 4px 4px 0 0; }
    &--returning { background: var(--series-returning); }
    &--new { background: var(--series-new); }
  }

  &__tip {
    position: absolute;
    top: 0.25rem;
    transform: translateX(0.5rem);
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.5rem 0.65rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    white-space: nowrap;
    pointer-events: none;
    z-index: 1;

    strong { color: var(--color-text); }

    span { display: inline-flex; align-items: center; }
    .legend__key { margin-right: 0.4rem; }

    &--left { transform: translateX(calc(-100% - 0.5rem)); }
  }

  &__x {
    grid-column: 2;
    display: flex;
    justify-content: space-between;
    padding-top: 0.35rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
}

.kpi-table {
  margin-top: 1rem;

  summary {
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--color-text-muted);
    &:hover { color: var(--color-text); }
  }

  table { margin-top: 0.5rem; }

  // Right-aligned headers over right-aligned numbers, tabular figures so
  // digits line up, and a bounded width so columns do not drift apart.
  .daily {
    width: auto;
    min-width: min(100%, 560px);

    th.num, td.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    th + th, td + td { padding-left: 1.5rem; }
  }
}

// ── Horizontal bars (loq usage, countries) ───────────────────────────────
// TASK-183 — the country list carries a rank column in front.
.hbar.hbar--ranked {
  grid-template-columns: 2rem minmax(0, 9rem) minmax(2rem, 1fr) auto;
}

.hbar__rank {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);

  &__pos { font-variant-numeric: tabular-nums; }

  &__btn {
    width: 1.75rem;
    height: 1.75rem;
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    background: transparent;
    color: var(--color-text);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;

    &:hover:not(:disabled) { border-color: var(--color-accent); }
    &:disabled { opacity: 0.35; cursor: default; }
  }
}
.hbar {
  display: grid;
  grid-template-columns: minmax(0, 11rem) minmax(2rem, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.3rem 0;
  font-size: 0.85rem;

  &__label {
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--muted { color: var(--color-text-muted); }
  }

  &__track {
    height: 10px;
  }

  &__fill {
    height: 100%;
    min-width: 2px;
    background: var(--color-accent);
    border-radius: 0 4px 4px 0;
  }

  &__value {
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
}
</style>
