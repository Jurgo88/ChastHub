<template>
  <section class="insight">
    <header class="insight__head">
      <h2>Which sources bring people who stay and pay</h2>
      <span v-if="data?.since" class="text-muted">signups since {{ formatDay(data.since) }}</span>
    </header>

    <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>
    <p v-else-if="error" class="error-text">{{ error }}</p>
    <p v-else-if="!data?.rows.length" class="text-muted">No sources recorded yet. They are saved from each new signup on.</p>

    <template v-else>
      <table class="admin-table admin-table--compact quality">
        <thead>
          <tr>
            <th>Source</th>
            <th class="num">Signups</th>
            <th class="num">Used a lock</th>
            <th class="num">Ever paid</th>
            <th class="num">Paying now</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in data.rows" :key="r.source ?? '∅'" :class="{ 'quality__none': !r.source }">
            <td>
              {{ r.source ?? 'No source' }}
              <span v-if="r.tagged" class="tag" title="From a tagged (UTM) link">UTM</span>
            </td>
            <td class="num">{{ r.signups }}</td>
            <td class="num">{{ r.used_loq }} <span class="share">{{ pctOf(r.used_loq, r.signups) }}</span></td>
            <td class="num">
              {{ r.ever_paid }} <span class="share">{{ pctOf(r.ever_paid, r.signups) }}</span>
              <span class="meter" :title="`${pctOf(r.ever_paid, r.signups)} of this source's signups paid`">
                <span class="meter__fill" :style="{ width: pctOf(r.ever_paid, r.signups) === '–' ? '0' : pctOf(r.ever_paid, r.signups) }" />
              </span>
            </td>
            <td class="num">{{ r.paying_now }}</td>
          </tr>
        </tbody>
      </table>
      <p class="kpi-note">
        Percentages are of that source's signups. "Used a lock" means they were in an accepted lock;
        "ever paid" means at least one successful payment. Small sources swing a lot, so read percentages
        next to the counts.
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
// TASK-185 — admin_source_quality() (migration 001).
interface Row {
  source: string | null
  tagged: boolean
  signups: number
  used_loq: number
  ever_paid: number
  paying_now: number
}

const { data, loading, error } = useInsight<{ since: string | null; rows: Row[] }>('/api/admin/insights/sources')

function formatDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
</script>

<style lang="scss" scoped>
@use '~/pages/admin/admin-shared';
@use './insight';

.quality {
  width: auto;
  min-width: min(100%, 640px);

  th.num, td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  th + th, td + td { padding-left: 1.5rem; }

  &__none td { color: var(--color-text-muted); }
}

.share {
  display: inline-block;
  min-width: 2.6rem;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.tag {
  margin-left: 0.4rem;
  padding: 0 0.35rem;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  background: rgba(var(--color-accent-rgb), 0.15);
  color: var(--color-accent);
  vertical-align: 1px;
}

// One hue, magnitude only: how much of the source converts to paying.
.meter {
  display: inline-block;
  width: 3rem;
  height: 6px;
  margin-left: 0.5rem;
  border-radius: 3px;
  background: var(--color-border);
  vertical-align: middle;
  overflow: hidden;

  &__fill {
    display: block;
    height: 100%;
    background: var(--color-accent);
  }
}
</style>
