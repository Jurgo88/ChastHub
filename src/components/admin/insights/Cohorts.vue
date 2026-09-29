<template>
  <section class="insight">
    <header class="insight__head">
      <h2>Do people come back? Retention by signup week</h2>
      <span class="text-muted">since launch</span>
    </header>

    <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>
    <p v-else-if="error" class="error-text">{{ error }}</p>
    <p v-else-if="!data?.cohorts.length" class="text-muted">No signups since launch yet.</p>

    <template v-else>
      <table class="admin-table admin-table--compact heat">
        <thead>
          <tr>
            <th>Signed up week of</th>
            <th class="num">People</th>
            <th class="num" title="Active the day after signing up">Next day</th>
            <th class="num" title="Active on any of the 7 days after signing up">Week 1</th>
            <th class="num" title="Active on any of days 8–30 after signing up">Month 1</th>
            <th class="num" title="Made at least one payment">Paid</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in data.cohorts" :key="c.week">
            <td>{{ formatDay(c.week) }}</td>
            <td class="num">{{ c.size }}</td>
            <td v-for="cell in cells(c)" :key="cell.key" class="num heat__cell" :style="shade(cell)" :title="cell.title">
              <template v-if="cell.base">
                <strong>{{ pctOf(cell.n, cell.base) }}</strong>
                <span class="heat__n">{{ cell.n }}/{{ cell.base }}</span>
              </template>
              <span v-else class="heat__open">–</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="kpi-note">
        A stronger colour means more people came back. A cell counts only people whose window is over, so a new week fills in over time;
        "–" means nobody in that week has reached it yet. Active = opened the app or did something in it.
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
// TASK-188 — admin_retention_cohorts() (migration 001).
interface Cohort {
  week: string
  size: number
  d1_base: number; d1: number
  w1_base: number; w1: number
  m1_base: number; m1: number
  paid: number
}
interface Cell { key: string; n: number; base: number; title: string }

const { data, loading, error } = useInsight<{ cohorts: Cohort[] }>('/api/admin/insights/cohorts')

function cells(c: Cohort): Cell[] {
  return [
    { key: 'd1', n: c.d1, base: c.d1_base, title: 'Back the next day' },
    { key: 'w1', n: c.w1, base: c.w1_base, title: 'Back within the first week' },
    { key: 'm1', n: c.m1, base: c.m1_base, title: 'Back in days 8–30' },
    // Paid has no window: the whole cohort is the base.
    { key: 'paid', n: c.paid, base: c.size, title: 'Paid at least once' },
  ]
}

// One hue, light → dark with the share: a sequential scale, not a rainbow.
function shade(cell: Cell) {
  if (!cell.base) return {}
  const share = cell.n / cell.base
  return { background: `rgba(var(--color-accent-rgb), ${(0.06 + share * 0.5).toFixed(3)})` }
}

function formatDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
</script>

<style lang="scss" scoped>
@use '~/pages/admin/admin-shared';
@use './insight';

.heat {
  width: auto;
  min-width: min(100%, 640px);

  th.num, td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  th + th, td + td { padding-left: 1.25rem; }

  &__cell {
    border-left: 2px solid var(--color-surface);
    min-width: 6.5rem;

    strong { color: var(--color-text); font-weight: 600; }
  }

  &__n {
    margin-left: 0.4rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  &__open { color: var(--color-text-muted); }
}
</style>
