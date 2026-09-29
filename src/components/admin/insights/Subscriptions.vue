<template>
  <section class="insight">
    <header class="insight__head">
      <h2>Subscriptions over time</h2>
      <span class="text-muted">last 12 weeks · super admins only</span>
    </header>

    <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>
    <p v-else-if="error" class="error-text">{{ error }}</p>

    <template v-else-if="data">
      <div class="kpi-grid tiles">
        <div class="kpi-card">
          <span class="kpi-card__label">Paying now</span>
          <span class="kpi-card__value">{{ data.paying_now }}</span>
          <span class="kpi-card__sub">{{ data.cancelling_now }} cancelling at the end of their period</span>
        </div>
        <div class="kpi-card" :class="{ 'kpi-card--warn': data.past_due.length }">
          <span class="kpi-card__label">Payment failed</span>
          <span class="kpi-card__value">{{ data.past_due.length }}</span>
          <span class="kpi-card__sub">still have access — worth a message before it lapses</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">New paying · 4 weeks</span>
          <span class="kpi-card__value">{{ last4('new_paying') }}</span>
          <span class="kpi-card__sub">{{ last4('cancel_requests') }} {{ last4('cancel_requests') === 1 ? 'cancellation' : 'cancellations' }} in the same weeks</span>
        </div>
      </div>

      <table class="admin-table admin-table--compact weekly">
        <thead>
          <tr>
            <th>Week of</th>
            <th class="num">New paying</th>
            <th class="num">Payments</th>
            <th class="num">Collected</th>
            <th class="num">Cancelled</th>
            <th class="num">Ended</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in weeks" :key="w.week">
            <td>{{ formatDay(w.week) }}</td>
            <td class="num">{{ w.new_paying }}</td>
            <td class="num">{{ w.payments }}</td>
            <td class="num">{{ money(w.collected) }}</td>
            <td class="num">{{ w.cancel_requests }}</td>
            <td class="num">{{ w.ended }}</td>
          </tr>
        </tbody>
      </table>
      <p class="kpi-note">
        "Collected" is net of refunds. "Cancelled" is when someone asked to cancel (they keep access until the
        period ends); "Ended" is when access actually stopped. Both are recorded from the day this section went live.
      </p>

      <template v-if="data.past_due.length">
        <h3 class="sub">Payment failed — contact these people</h3>
        <table class="admin-table admin-table--compact">
          <thead><tr><th>Who</th><th>Plan</th><th>Access until</th></tr></thead>
          <tbody>
            <tr v-for="p in data.past_due" :key="p.user_id">
              <td>
                <NuxtLink :to="`/admin/users/${p.user_id}`" class="who">{{ p.display_name || p.email }}</NuxtLink>
                <span v-if="p.display_name" class="text-muted"> · {{ p.email }}</span>
              </td>
              <td>{{ plan(p) }}</td>
              <td>{{ p.access_until ? formatDay(p.access_until) : '–' }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
// TASK-187 — admin_subscription_trends() (migration 076). The page renders
// this for super admins only; the endpoint enforces the same.
interface Week {
  week: string
  new_paying: number
  payments: number
  collected: Record<string, number>
  cancel_requests: number
  ended: number
}
interface PastDue {
  user_id: string
  display_name: string | null
  email: string
  access_until: string | null
  plan_amount: number | null
  plan_currency: string | null
  plan_interval: string | null
}

const { data, loading, error } = useInsight<{
  paying_now: number
  cancelling_now: number
  weekly: Week[]
  past_due: PastDue[]
}>('/api/admin/insights/subscriptions')

// Newest first, without the empty weeks before the first payment.
const weeks = computed(() => {
  const all = data.value?.weekly ?? []
  const first = all.findIndex(w => w.payments || w.cancel_requests || w.ended)
  return first === -1 ? [] : all.slice(first).reverse()
})

function last4(key: 'new_paying' | 'cancel_requests') {
  return (data.value?.weekly ?? []).slice(-4).reduce((n, w) => n + w[key], 0)
}

// Amounts are minor units, per currency.
function money(byCurrency: Record<string, number>) {
  const parts = Object.entries(byCurrency ?? {})
  if (!parts.length) return '–'
  return parts.map(([c, v]) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: c.toUpperCase() }).format(v / 100)).join(' + ')
}

function plan(p: PastDue) {
  if (!p.plan_amount || !p.plan_currency) return '–'
  const amount = new Intl.NumberFormat('en-GB', { style: 'currency', currency: p.plan_currency.toUpperCase() }).format(p.plan_amount / 100)
  return p.plan_interval ? `${amount} / ${p.plan_interval}` : amount
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

.kpi-card--warn {
  border-color: rgba(237, 137, 54, 0.6);
  box-shadow: inset 3px 0 0 #f6ad55;
}

.weekly {
  width: auto;
  min-width: min(100%, 600px);

  th.num, td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  th + th, td + td { padding-left: 1.5rem; }
}

.sub {
  margin: 1.5rem 0 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
}

.who {
  color: var(--color-accent);
  text-decoration: none;
  &:hover { text-decoration: underline; }
}
</style>
