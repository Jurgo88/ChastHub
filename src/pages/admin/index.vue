<template>
  <div class="admin-section">
    <div class="admin-section-header">
      <h1>Dashboard</h1>
    </div>

    <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>

    <div v-else-if="metrics" class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-card__label">Users</span>
        <span class="kpi-card__value">{{ metrics.users.total }}</span>
        <span class="kpi-card__sub">{{ metrics.users.loqee }} wearer · {{ metrics.users.loqholder }} keyholder</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-card__label">New signups</span>
        <span class="kpi-card__value">{{ metrics.signups.last_7d }}</span>
        <span class="kpi-card__sub">last 7 days · {{ metrics.signups.last_30d }} in last 30 days</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-card__label">Active locks</span>
        <span class="kpi-card__value">{{ metrics.active_loqs }}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-card__label">Open reports</span>
        <span class="kpi-card__value">{{ metrics.open_reports }}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-card__label">Active subscriptions</span>
        <span class="kpi-card__value">{{ metrics.active_subscriptions }}</span>
      </div>
    </div>

    <p v-else class="error-text">Failed to load metrics.</p>

    <!-- TASK-160 — product KPIs. TASK-182 — for every admin level that can
         open this page (the endpoint allows the same set). Revenue below
         stays super_admin only. -->
    <AdminKpiPanel />

    <!-- TASK-136 — revenue is super_admin only, both here and on the endpoint. -->
    <template v-if="isSuperAdmin">
      <div class="admin-section-header revenue-header">
        <h2>Revenue</h2>
      </div>

      <div v-if="revenueLoading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>

      <div v-else-if="revenueError" class="admin-error">⚠️ {{ revenueError }}</div>

      <p v-else-if="!revenue.length" class="admin-empty">
        💳 No payments recorded yet. If Stripe has history from before this was
        added, run <code>node scripts/backfill-payments.mjs</code>.
      </p>

      <div v-for="c in revenue" :key="c.currency" class="kpi-grid revenue-grid">
        <div class="kpi-card">
          <span class="kpi-card__label">Collected all time</span>
          <span class="kpi-card__value">{{ money(c.lifetime.collected, c.currency) }}</span>
          <span class="kpi-card__sub">
            {{ money(c.lifetime.net, c.currency) }} net after {{ money(c.lifetime.fees, c.currency) }} Stripe fees
          </span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">This month</span>
          <span class="kpi-card__value">{{ money(c.this_month.collected, c.currency) }}</span>
          <span class="kpi-card__sub">{{ money(c.this_month.net, c.currency) }} net</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">Last 30 days</span>
          <span class="kpi-card__value">{{ money(c.last_30d.collected, c.currency) }}</span>
          <span class="kpi-card__sub">{{ money(c.last_30d.net, c.currency) }} net</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">MRR</span>
          <span class="kpi-card__value">{{ money(c.mrr, c.currency) }}</span>
          <span class="kpi-card__sub">
            {{ c.active_subscriptions }} active · yearly plans counted as a twelfth
          </span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">Payments</span>
          <span class="kpi-card__value">{{ c.payments_count }}</span>
          <span class="kpi-card__sub">
            <template v-if="c.lifetime.refunded">{{ money(c.lifetime.refunded, c.currency) }} refunded</template>
            <template v-else>nothing refunded</template>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminLevel: ['analyst', 'support', 'super_admin'] })

interface AdminMetrics {
  users: { loqee: number; loqholder: number; total: number }
  signups: { last_7d: number; last_30d: number }
  active_loqs: number
  open_reports: number
  active_subscriptions: number
}

interface RevenueCurrency {
  currency: string
  payments_count: number
  lifetime: { collected: number; net: number; gross: number; refunded: number; fees: number }
  last_30d: { collected: number; net: number }
  this_month: { collected: number; net: number }
  mrr: number
  active_subscriptions: number
}

const { authFetch } = useAuthFetch()
const authStore = useAuthStore()
const isSuperAdmin = computed(() => authStore.isSuperAdmin)

const metrics = ref<AdminMetrics | null>(null)
const loading = ref(true)

const revenue = ref<RevenueCurrency[]>([])
const revenueLoading = ref(true)
const revenueError = ref('')

// Amounts arrive in minor units so nothing upstream has to round; this is the
// only place that divides.
function money(minorUnits: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(minorUnits / 100)
}

async function fetchRevenue() {
  revenueLoading.value = true
  revenueError.value = ''
  try {
    const res = await authFetch<{ currencies: RevenueCurrency[] }>('/api/admin/revenue')
    revenue.value = res.currencies
  }
  catch (e: any) {
    revenueError.value = e?.data?.message || e?.message || 'Failed to load revenue.'
    revenue.value = []
  }
  finally {
    revenueLoading.value = false
  }
}

async function fetchMetrics() {
  loading.value = true
  try {
    metrics.value = await authFetch<AdminMetrics>('/api/admin/metrics')
  }
  catch {
    metrics.value = null
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchMetrics()
  if (isSuperAdmin.value) fetchRevenue()
})
</script>

<style lang="scss" scoped>
@use './admin-shared';

.revenue-header {
  margin-top: 1rem;

  h2 {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
  }
}

.revenue-grid + .revenue-grid {
  margin-top: 1rem;
}

</style>
