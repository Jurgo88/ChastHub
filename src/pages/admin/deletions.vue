<template>
  <div class="admin-section">
    <div class="admin-section-header">
      <h1>Deleted accounts</h1>
      <span v-if="!loading && !error" class="deletions-total">{{ total }} total</span>
    </div>

    <p class="deletions-intro">
      Deleting anonymizes the profile, so the address and the reason live only in the audit log.
      This page is the only place they are readable, and only for super admins.
    </p>

    <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>

    <div v-else-if="error" class="admin-error">⚠️ {{ error }}</div>

    <template v-else>
      <div v-if="breakdown.length" class="breakdown">
        <div v-for="b in breakdown" :key="b.reason" class="breakdown__item">
          <span class="breakdown__count">{{ b.count }}</span>
          <span class="breakdown__label">{{ reasonLabel(b.reason) }}</span>
        </div>
        <p v-if="breakdownCapped" class="breakdown__note">
          Counts cover the most recent {{ BREAKDOWN_CAP.toLocaleString() }} deletions only.
        </p>
      </div>

      <table class="admin-table">
        <thead>
          <tr>
            <th>
              <button class="sort-btn" @click="toggleSort">
                Deleted {{ dir === 'desc' ? '↓' : '↑' }}
              </button>
            </th>
            <th>Email</th>
            <th>From</th>
            <th>Reason</th>
            <th>Note</th>
            <th>Subscription</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in deletions" :key="d.id">
            <td :title="formatDateTimeFull(d.deleted_at)">{{ formatDate(d.deleted_at) }}</td>
            <td>
              <!-- Deletions recorded before TASK-138 kept no address. -->
              <span v-if="d.email">{{ d.email }}</span>
              <span v-else class="muted">not recorded</span>
            </td>
            <td :title="originTitle(d)">
              <span v-if="d.signup_country" class="country">{{ d.signup_country }}</span>
              <span v-else class="muted">–</span>
            </td>
            <td>
              <span v-if="d.reason" class="badge">{{ reasonLabel(d.reason) }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td class="note-cell">
              <span v-if="d.note">{{ d.note }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td>
              <span v-if="d.subscription_cancelled" class="badge badge--cancelling">cancelled</span>
              <span v-else class="muted">—</span>
            </td>
          </tr>
          <tr v-if="deletions.length === 0">
            <td colspan="6" class="admin-empty">👋 Nobody has deleted their account.</td>
          </tr>
        </tbody>
      </table>

      <div v-if="total > limit" class="admin-pagination">
        <button class="btn btn-outline" :disabled="offset === 0" @click="prev">Previous</button>
        <span>{{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}</span>
        <button class="btn btn-outline" :disabled="offset + limit >= total" @click="next">Next</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { deletionReasonLabel } from '~/utils/deletionReasons'

definePageMeta({ layout: 'admin', middleware: 'admin', adminLevel: ['super_admin'] })

interface Deletion {
  id: string
  user_id: string | null
  deleted_at: string
  email: string | null
  reason: string | null
  note: string | null
  subscription_cancelled: boolean
  signup_country: string | null
  signup_region: string | null
  signup_timezone: string | null
  signup_locale: string | null
}

// Mirrors the server cap; only used to word the footnote.
const BREAKDOWN_CAP = 10000

const { authFetch } = useAuthFetch()
const { formatDate, formatDateTimeFull } = useFormatters()

const deletions = ref<Deletion[]>([])
const breakdown = ref<{ reason: string, count: number }[]>([])
const breakdownCapped = ref(false)
const total = ref(0)
const loading = ref(true)
const error = ref('')
const offset = ref(0)
const dir = ref<'asc' | 'desc'>('desc')
const limit = 50

// TASK-141 — only the country code fits the column; region, timezone and
// language go in the tooltip. Matches /admin/users, except that a blank here
// means something different: the account was deleted before its origin was
// being kept, not before it was being captured.
function originTitle(d: Deletion) {
  if (!d.signup_country && !d.signup_timezone && !d.signup_locale) {
    return 'Not recorded — this deletion predates the origin being kept'
  }
  return [
    [d.signup_region, d.signup_country].filter(Boolean).join(', '),
    d.signup_timezone,
    d.signup_locale,
  ].filter(Boolean).join(' · ')
}

// 'unknown' is the server's bucket for pre-TASK-138 rows, not a reason value.
function reasonLabel(reason: string) {
  return reason === 'unknown' ? 'Not recorded' : deletionReasonLabel(reason)
}

async function fetchDeletions() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset.value),
      dir: dir.value,
    })
    const res = await authFetch<{
      deletions: Deletion[]
      total: number
      breakdown: { reason: string, count: number }[]
      breakdown_capped: boolean
    }>(`/api/admin/deletions?${params}`)
    deletions.value = res.deletions
    total.value = res.total
    breakdown.value = res.breakdown
    breakdownCapped.value = res.breakdown_capped
  }
  catch (err: unknown) {
    const e = err as { data?: { message?: string }, message?: string }
    error.value = e?.data?.message ?? e?.message ?? 'Failed to load deletions'
    deletions.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

function toggleSort() {
  dir.value = dir.value === 'desc' ? 'asc' : 'desc'
  offset.value = 0
  fetchDeletions()
}

function prev() { offset.value = Math.max(0, offset.value - limit); fetchDeletions() }
function next() { offset.value += limit; fetchDeletions() }

onMounted(fetchDeletions)
</script>

<style lang="scss" scoped>
@use './admin-shared';

.deletions-total {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.deletions-intro {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  max-width: 62ch;
}

.breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  padding: 0.85rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;

  &__item {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }

  &__count {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--color-text);
  }

  &__label {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }

  &__note {
    flex-basis: 100%;
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
}

.sort-btn {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.note-cell {
  max-width: 34ch;
  white-space: normal;
  word-break: break-word;
}

.country {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.03em;
}

.muted {
  color: var(--color-text-muted);
}
</style>
