<template>
  <div class="admin-section">
    <div class="admin-section-header">
      <h1>Audit log</h1>
      <span v-if="userFilter" class="user-chip">
        Only entries involving <code>{{ userFilter.slice(0, 8) }}…</code>
        <NuxtLink :to="{ query: { ...route.query, user: undefined } }" aria-label="Show everyone">✕</NuxtLink>
      </span>
    </div>

    <div class="filter-tabs">
      <button
        v-for="t in TABS"
        :key="t.value"
        class="filter-tab"
        :class="{ 'filter-tab--active': group === t.value }"
        @click="setGroup(t.value)"
      >
        {{ t.label }}
      </button>
    </div>

    <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>

    <div v-else-if="error" class="admin-error">⚠️ {{ error }}</div>

    <table v-else class="admin-table admin-table--compact">
      <thead>
        <tr><th>When</th><th>Action</th><th>By</th><th>On</th><th>Details</th></tr>
      </thead>
      <tbody>
        <tr v-for="e in entries" :key="e.id">
          <td class="nowrap" :title="formatDateTimeFull(e.created_at)">{{ formatDateTimeFull(e.created_at) }}</td>
          <td class="nowrap">{{ AUDIT_ACTION_LABELS[e.action] ?? e.action }}</td>
          <td><NuxtLink v-if="e.actor" :to="`/admin/users/${e.actor.id}`">{{ who(e.actor) }}</NuxtLink><span v-else class="text-muted">–</span></td>
          <td><NuxtLink v-if="e.target" :to="`/admin/users/${e.target.id}`">{{ who(e.target) }}</NuxtLink><span v-else class="text-muted">–</span></td>
          <td class="details">
            <span v-for="[k, v] in detailPairs(e.details)" :key="k" class="details__pair">
              <span class="details__key">{{ k }}</span> {{ v }}
            </span>
          </td>
        </tr>
        <tr v-if="entries.length === 0">
          <td colspan="5" class="admin-empty">📜 Nothing logged here.</td>
        </tr>
      </tbody>
    </table>

    <div v-if="total > limit" class="admin-pagination">
      <button class="btn btn-outline" :disabled="offset === 0" @click="page(-1)">Previous</button>
      <span>{{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}</span>
      <button class="btn btn-outline" :disabled="offset + limit >= total" @click="page(1)">Next</button>
    </div>
  </div>
</template>

<script setup lang="ts">
// TASK-169 — who did what, and when.
definePageMeta({ layout: 'admin', middleware: 'admin', adminLevel: ['super_admin'] })

interface Person { id: string; display_name: string | null; email: string }
interface Entry {
  id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
  actor: Person | null
  target: Person | null
}

type Group = 'admin' | 'loqs' | 'all'
const TABS: { value: Group; label: string }[] = [
  { value: 'admin', label: 'Admin actions' },
  { value: 'loqs', label: 'Locks' },
  { value: 'all', label: 'All' },
]

const route = useRoute()
const { authFetch } = useAuthFetch()
const { formatDateTimeFull } = useFormatters()

const entries = ref<Entry[]>([])
const total = ref(0)
const group = ref<Group>('admin')
const offset = ref(0)
const limit = 50
const loading = ref(true)
const error = ref('')

// ?user=<id>, set by the "Audit log" link on the admin user page.
const userFilter = computed(() => typeof route.query.user === 'string' ? route.query.user : null)

async function fetchEntries() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset.value) })
    if (group.value !== 'all') params.set('actions', AUDIT_ACTION_GROUPS[group.value].join(','))
    if (userFilter.value) params.set('user', userFilter.value)
    const res = await authFetch<{ entries: Entry[]; total: number }>(`/api/admin/audit-log?${params}`)
    entries.value = res.entries
    total.value = res.total
  }
  catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to load the audit log.'
    entries.value = []
  }
  finally {
    loading.value = false
  }
}

function setGroup(g: Group) {
  group.value = g
  offset.value = 0
  fetchEntries()
}

function page(dir: 1 | -1) {
  offset.value = Math.max(0, offset.value + dir * limit)
  fetchEntries()
}

function who(p: Person) {
  return p.display_name || p.email
}

// Flat key/value pairs, nulls dropped — details differ per action and are
// small, so they read better inline than as JSON.
function detailPairs(details: Record<string, unknown> | null): [string, string][] {
  if (!details) return []
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => [k.replace(/_/g, ' '), typeof v === 'object' ? JSON.stringify(v) : String(v)])
}

watch(userFilter, () => { offset.value = 0; fetchEntries() })
onMounted(fetchEntries)
</script>

<style lang="scss" scoped>
@use './admin-shared';

.nowrap { white-space: nowrap; }

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);

  a { color: var(--color-text-muted); text-decoration: none; }
  a:hover { color: var(--color-text); }
}

.details {
  font-size: 0.8rem;
  color: var(--color-text);

  &__pair {
    display: inline-block;
    margin-right: 0.75rem;
    overflow-wrap: anywhere;
  }

  &__key { color: var(--color-text-muted); }
}

td a {
  color: var(--color-accent);
  text-decoration: none;
  &:hover { text-decoration: underline; }
}
</style>
