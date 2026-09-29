<template>
  <div class="admin-section">
    <div class="admin-section-header">
      <h1>Reports</h1>
      <div class="filter-tabs">
        <button
          v-for="f in filters"
          :key="f.value"
          class="filter-tab"
          :class="{ 'filter-tab--active': activeFilter === f.value }"
          @click="setFilter(f.value)"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>

    <table v-else class="admin-table">
      <thead>
        <tr>
          <th>Reported user</th>
          <th>Reported by</th>
          <th>Reason</th>
          <th>Status</th>
          <th>Date</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="report in reports" :key="report.id">
          <td>{{ report.reported_user?.email ?? '–' }}</td>
          <td>{{ report.reported_by?.email ?? '–' }}</td>
          <td>{{ report.reason }}</td>
          <td><span class="badge" :class="`badge--${report.status}`">{{ report.status }}</span></td>
          <td :title="formatDateTimeFull(report.created_at)">{{ formatDate(report.created_at) }}</td>
          <td>
            <div class="action-group">
              <NuxtLink
                v-if="report.conversation_id"
                :to="`/admin/messages?conversation=${report.conversation_id}`"
                class="btn btn-outline btn-sm"
              >View conversation</NuxtLink>
              <template v-if="report.status === 'open'">
                <button class="btn btn-outline btn-sm" @click="resolve(report, 'dismiss')">Dismiss</button>
                <button class="btn btn-danger btn-sm" @click="resolve(report, 'ban')">Ban user</button>
              </template>
            </div>
          </td>
        </tr>
        <tr v-if="reports.length === 0">
          <td colspan="6" class="admin-empty">🚩 No reports found.</td>
        </tr>
      </tbody>
    </table>

    <div v-if="total > limit" class="admin-pagination">
      <button class="btn btn-outline" :disabled="offset === 0" @click="prev">Previous</button>
      <span>{{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}</span>
      <button class="btn btn-outline" :disabled="offset + limit >= total" @click="next">Next</button>
    </div>

    <!-- Description modal (view details) -->
    <div v-if="activeReport" class="modal-overlay" @click.self="activeReport = null">
      <div class="modal">
        <h2>Resolve report</h2>
        <p class="modal-note">
          <strong>{{ activeReport.reported_user?.email }}</strong> reported for: {{ activeReport.reason }}
        </p>
        <p v-if="activeReport.description" class="modal-note report-description">{{ activeReport.description }}</p>
        <p class="modal-note">
          Action: <strong>{{ resolveAction === 'ban' ? 'Ban user' : 'Dismiss' }}</strong>
        </p>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="activeReport = null">Cancel</button>
          <button
            class="btn"
            :class="resolveAction === 'ban' ? 'btn-danger' : 'btn-outline'"
            :disabled="resolving"
            @click="confirmResolve"
          >
            {{ resolving ? 'Processing…' : resolveAction === 'ban' ? 'Confirm ban' : 'Confirm dismiss' }}
          </button>
        </div>
        <p v-if="resolveError" class="error-text">{{ resolveError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminLevel: ['support', 'super_admin'] })

const { authFetch } = useAuthFetch()
const { formatDate, formatDateTimeFull } = useFormatters()

const filters = [
  { label: 'Open', value: 'open' },
  { label: 'Dismissed', value: 'dismissed' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'All', value: '' },
]

const reports = ref<any[]>([])
const total = ref(0)
const loading = ref(true)
const activeFilter = ref('open')
const offset = ref(0)
const limit = 50

const activeReport = ref<any | null>(null)
const resolveAction = ref<'dismiss' | 'ban'>('dismiss')
const resolving = ref(false)
const resolveError = ref('')

async function fetchReports() {
  loading.value = true
  try {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset.value) })
    if (activeFilter.value) params.set('status', activeFilter.value)
    const res = await authFetch<{ reports: any[]; total: number }>(`/api/admin/reports?${params}`)
    reports.value = res.reports
    total.value = res.total
  }
  finally {
    loading.value = false
  }
}

function setFilter(value: string) {
  activeFilter.value = value
  offset.value = 0
  fetchReports()
}

function resolve(report: any, action: 'dismiss' | 'ban') {
  activeReport.value = report
  resolveAction.value = action
  resolveError.value = ''
}

async function confirmResolve() {
  if (!activeReport.value) return
  resolving.value = true
  resolveError.value = ''
  try {
    await authFetch(`/api/admin/reports/${activeReport.value.id}/resolve`, {
      method: 'POST',
      body: { action: resolveAction.value },
    })
    activeReport.value = null
    await fetchReports()
  }
  catch {
    resolveError.value = 'Failed. Please try again.'
  }
  finally {
    resolving.value = false
  }
}

function prev() { offset.value = Math.max(0, offset.value - limit); fetchReports() }
function next() { offset.value += limit; fetchReports() }

onMounted(fetchReports)
</script>

<style lang="scss" scoped>
@use './admin-shared';

.action-group {
  display: flex;
  gap: 0.5rem;
}

.report-description {
  font-style: italic;
}
</style>
