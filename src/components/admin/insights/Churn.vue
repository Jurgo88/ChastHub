<template>
  <section class="insight">
    <header class="insight__head">
      <h2>Why people leave, week by week</h2>
      <span class="text-muted">account deletions since launch</span>
    </header>

    <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>
    <p v-else-if="error" class="error-text">{{ error }}</p>
    <p v-else-if="!grandTotal" class="text-muted">No account has been deleted since launch.</p>

    <template v-else>
      <table class="admin-table admin-table--compact churn">
        <thead>
          <tr>
            <th>Week of</th>
            <th v-for="r in columns" :key="r" class="num" :title="fullLabel(r)">{{ SHORT[r] ?? r }}</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in data!.weeks" :key="w.week">
            <td>{{ formatDay(w.week) }}</td>
            <td
              v-for="r in columns"
              :key="r"
              class="num churn__cell"
              :style="shade(w.by_reason[r] ?? 0)"
              :title="`${fullLabel(r)}: ${w.by_reason[r] ?? 0}`"
            >
              {{ w.by_reason[r] || '' }}
            </td>
            <td class="num churn__total">{{ w.total }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>All weeks</td>
            <td v-for="r in columns" :key="r" class="num">{{ data!.totals[r] ?? 0 }}</td>
            <td class="num churn__total">{{ grandTotal }}</td>
          </tr>
        </tfoot>
      </table>
      <p class="kpi-note">
        The reason each person picked when deleting their account. Only reasons someone has picked are shown;
        hover a column for its full wording. The notes and addresses are in Deletions (super admins).
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
// TASK-189 — admin_churn_reasons() (migration 078).
import { DELETION_REASONS, deletionReasonLabel } from '~/utils/deletionReasons'

interface ChurnWeek { week: string; total: number; by_reason: Record<string, number> }

const { data, loading, error } = useInsight<{ weeks: ChurnWeek[]; totals: Record<string, number> }>('/api/admin/insights/churn')

// Column headers; the dialog's own wording is in the tooltip.
const SHORT: Record<string, string> = {
  too_expensive: 'Price',
  not_using: 'Not using',
  taking_break: 'Break',
  missing_features: 'Missing',
  technical_issues: 'Bugs',
  bad_experience: 'Bad experience',
  privacy: 'Privacy',
  other: 'Other',
  unknown: 'Not given',
}

// In the dialog's order, only those someone picked; "not given" last.
const columns = computed(() => {
  const totals = data.value?.totals ?? {}
  const known = DELETION_REASONS.map(r => r.value).filter(v => totals[v])
  const extra = Object.keys(totals).filter(v => !known.includes(v) && v !== 'unknown')
  return [...known, ...extra, ...(totals.unknown ? ['unknown'] : [])]
})

const grandTotal = computed(() => Object.values(data.value?.totals ?? {}).reduce((n, v) => n + v, 0))
const maxCell = computed(() => Math.max(1, ...(data.value?.weeks ?? []).flatMap(w => Object.values(w.by_reason))))

function fullLabel(reason: string) {
  return reason === 'unknown' ? 'No reason recorded' : deletionReasonLabel(reason)
}

// One hue, stronger with the count.
function shade(n: number) {
  if (!n) return {}
  return { background: `rgba(var(--color-accent-rgb), ${(0.08 + (n / maxCell.value) * 0.5).toFixed(3)})` }
}

function formatDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
</script>

<style lang="scss" scoped>
@use '~/pages/admin/admin-shared';
@use './insight';

.churn {
  width: auto;
  min-width: min(100%, 560px);

  th.num, td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  th + th, td + td { padding-left: 1rem; }

  &__cell {
    min-width: 3.5rem;
    border-left: 2px solid var(--color-surface);
    color: var(--color-text);
    font-weight: 600;
  }

  &__total { color: var(--color-text-muted); }

  tfoot td {
    border-top: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-weight: 600;
  }
}
</style>
