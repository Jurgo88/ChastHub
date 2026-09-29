<template>
  <div class="admin-section">
    <div class="admin-section-header">
      <h1>Locks</h1>
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

    <div v-else-if="error" class="admin-error">⚠️ {{ error }}</div>

    <table v-else class="admin-table">
      <thead>
        <tr>
          <th>Keyholder</th>
          <th>Wearer</th>
          <th>Status</th>
          <th>Started</th>
          <th>Ended</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="loq in loqs" :key="loq.id">
          <td>
            <span v-if="!loq.loqholder" class="badge badge--self">SELF</span>
            <template v-else>{{ loq.loqholder?.display_name || loq.loqholder?.email || '–' }}</template>
          </td>
          <td>{{ loq.loqee?.display_name || loq.loqee?.email || '–' }}</td>
          <td><span class="badge" :class="`badge--${loq.status}`">{{ loq.status }}</span></td>
          <td :title="loq.accepted_at ? formatDateTimeFull(loq.accepted_at) : undefined">
            {{ loq.accepted_at ? formatDate(loq.accepted_at) : '–' }}
          </td>
          <td :title="loq.ended_at ? formatDateTimeFull(loq.ended_at) : undefined">
            {{ loq.ended_at ? formatDate(loq.ended_at) : '–' }}
          </td>
          <td>
            <NuxtLink :to="`/admin/messages?loq=${loq.id}`" class="btn btn-outline btn-sm">
              Messages
            </NuxtLink>
          </td>
        </tr>
        <tr v-if="loqs.length === 0">
          <td colspan="6" class="admin-empty">🔍 No locks found.</td>
        </tr>
      </tbody>
    </table>

    <div v-if="total > limit" class="admin-pagination">
      <button class="btn btn-outline" :disabled="offset === 0" @click="prev">Previous</button>
      <span>{{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}</span>
      <button class="btn btn-outline" :disabled="offset + limit >= total" @click="next">Next</button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminLevel: ['support', 'super_admin'] })

const { authFetch } = useAuthFetch()
const { formatDate, formatDateTimeFull } = useFormatters()

const filters = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Paused', value: 'paused' },
  { label: 'Draft', value: 'draft' },
  { label: 'Ended', value: 'ended' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Self-locks', value: 'self' },
]

const loqs = ref<any[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const activeFilter = ref('')
const offset = ref(0)
const limit = 50

async function fetchLoqs() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset.value) })
    if (activeFilter.value === 'self') params.set('self', 'true')
    else if (activeFilter.value) params.set('status', activeFilter.value)
    const res = await authFetch<{ loqs: any[]; total: number }>(`/api/admin/loqs?${params}`)
    loqs.value = res.loqs
    total.value = res.total
  }
  catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to load locks.'
    loqs.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

function setFilter(value: string) {
  activeFilter.value = value
  offset.value = 0
  fetchLoqs()
}

function prev() { offset.value = Math.max(0, offset.value - limit); fetchLoqs() }
function next() { offset.value += limit; fetchLoqs() }

onMounted(fetchLoqs)
</script>

<style lang="scss" scoped>
@use './admin-shared';
</style>
