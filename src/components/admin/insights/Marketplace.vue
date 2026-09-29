<template>
  <section class="insight">
    <header class="insight__head">
      <h2>Wearers and keyholders — are locks finding someone?</h2>
      <span class="text-muted">last 30 days</span>
    </header>

    <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>
    <p v-else-if="error" class="error-text">{{ error }}</p>

    <template v-else-if="data">
      <div class="kpi-grid tiles">
        <div class="kpi-card" :class="{ 'kpi-card--warn': data.waiting_over_24h > 0 }">
          <span class="kpi-card__label">Waiting for a keyholder</span>
          <span class="kpi-card__value">{{ data.waiting_now }}</span>
          <span class="kpi-card__sub">{{ data.waiting_over_24h }} of them for more than 24 h · {{ data.open_requests }} open requests</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">Time to find one</span>
          <span class="kpi-card__value">{{ hours(data.median_hours) }}</span>
          <span class="kpi-card__sub">median · 3 in 4 within {{ hours(data.p75_hours) }} · {{ data.accepted_30d }} accepted</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">Taken within 24 h</span>
          <span class="kpi-card__value">{{ pctOf(data.within_24h, data.within_24h_base) }}</span>
          <span class="kpi-card__sub">{{ data.within_24h }} of {{ data.within_24h_base }} published locks</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">Wearers per keyholder</span>
          <span class="kpi-card__value">{{ ratio(data.roles.loqee_active_30d, data.roles.loqholder_active_30d) }}</span>
          <span class="kpi-card__sub">
            active in 30 days: {{ data.roles.loqee_active_30d }} wearers · {{ data.roles.loqholder_active_30d }} keyholders
            (registered {{ data.roles.loqee_registered }} · {{ data.roles.loqholder_registered }})
          </span>
        </div>
      </div>

      <table class="admin-table admin-table--compact weekly">
        <thead>
          <tr>
            <th>Week of</th>
            <th class="num">Published</th>
            <th class="num">Accepted</th>
            <th class="num">Median wait</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in weeks" :key="w.week">
            <td>{{ formatDay(w.week) }}</td>
            <td class="num">{{ w.published }}</td>
            <td class="num">{{ w.accepted }}</td>
            <td class="num">{{ hours(w.median_hours) }}</td>
          </tr>
        </tbody>
      </table>

      <p class="kpi-note">
        A lock waits from when it is published (or a keyholder is requested) until one accepts.
        <template v-if="data.exact_since">Exact from {{ formatDay(data.exact_since) }}; earlier locks are measured from when they were created, which reads long.</template>
        <template v-else>Exact timing starts with the next published lock; until then waits are measured from when locks were created, which reads long.</template>
        "Active" means they opened the app in the last 30 days.
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
// TASK-186 — admin_marketplace() (migration 075).
interface Marketplace {
  exact_since: string | null
  waiting_now: number
  waiting_over_24h: number
  open_requests: number
  accepted_30d: number
  median_hours: number | null
  p75_hours: number | null
  within_24h_base: number
  within_24h: number
  weekly: { week: string; published: number; accepted: number; median_hours: number | null }[]
  roles: { loqee_registered: number; loqholder_registered: number; loqee_active_30d: number; loqholder_active_30d: number }
}

const { data, loading, error } = useInsight<Marketplace>('/api/admin/insights/marketplace')

// Newest first, without the empty weeks before the first loq (pre-launch).
const weeks = computed(() => {
  const all = data.value?.weekly ?? []
  const first = all.findIndex(w => w.published || w.accepted)
  return first === -1 ? [] : all.slice(first).reverse()
})

function hours(h: number | null) {
  if (h === null || h === undefined) return '–'
  const n = Number(h)
  return n < 48 ? `${n.toFixed(n < 10 ? 1 : 0)} h` : `${(n / 24).toFixed(1)} d`
}

function ratio(a: number, b: number) {
  return b ? (a / b).toFixed(1) : '–'
}

function formatDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
</script>

<style lang="scss" scoped>
@use '~/pages/admin/admin-shared';
@use './insight';

.tiles {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  margin-bottom: 1rem;
}

// Loqs already waiting over a day is the thing to act on.
.kpi-card--warn {
  border-color: rgba(237, 137, 54, 0.6);
  box-shadow: inset 3px 0 0 #f6ad55;
}

.weekly {
  width: auto;
  min-width: min(100%, 480px);

  th.num, td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  th + th, td + td { padding-left: 1.5rem; }
}
</style>
