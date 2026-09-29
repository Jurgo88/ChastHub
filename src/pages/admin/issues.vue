<template>
  <div class="admin-section">
    <div class="admin-section-header">
      <h1>Issues</h1>
      <span class="text-muted">
        {{ open }} open<template v-if="openSecurity"> · <strong class="sec-count">{{ openSecurity }} security</strong></template>
      </span>
    </div>

    <div class="filter-tabs">
      <button
        v-for="t in TABS"
        :key="t.value"
        class="filter-tab"
        :class="{ 'filter-tab--active': status === t.value }"
        @click="setStatus(t.value)"
      >
        {{ t.label }}
      </button>
      <span class="filter-sep" />
      <!-- TASK-173 — the public form takes bugs too; filter by kind. -->
      <button
        v-for="k in KIND_TABS"
        :key="k.value"
        class="filter-tab"
        :class="{ 'filter-tab--active': kind === k.value }"
        @click="setKind(k.value)"
      >
        {{ k.label }}
      </button>
      <span class="filter-sep" />
      <!-- TASK-177 — reports sent while deleting an account. -->
      <button
        class="filter-tab"
        :class="{ 'filter-tab--active': leaversOnly }"
        @click="toggleLeavers"
      >
        Left the app
      </button>
    </div>

    <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>

    <div v-else-if="error" class="admin-error">⚠️ {{ error }}</div>

    <p v-else-if="!reports.length" class="admin-empty">
      🛡️ {{ status === 'open' ? 'No open issues.' : 'No issues here.' }}
    </p>

    <div v-else class="sr-list">
      <article
        v-for="r in reports"
        :key="r.id"
        class="sr"
        :class="{ 'sr--handled': r.handled_at, 'sr--security': r.kind === 'security' && !r.handled_at }"
      >
        <header class="sr__head">
          <span class="kind" :class="`kind--${r.kind}`">{{ KIND_LABELS[r.kind] ?? r.kind }}</span>
          <!-- TASK-177 — why they left, and who it was. -->
          <span v-if="r.source === 'account_deletion'" class="leaver" :title="'Sent while deleting their account'">
            Left the app: {{ deletionReasonLabel(r.source_detail) }}
          </span>
          <NuxtLink v-if="r.reporter" :to="`/admin/users/${r.reporter.id}`" class="sr__reporter">
            {{ r.reporter.display_name || r.reporter.email }}
          </NuxtLink>
          <span class="badge" :class="r.handled_at ? 'badge--resolved' : 'badge--open'">
            {{ r.handled_at ? 'handled' : 'open' }}
          </span>
          <span class="sr__time" :title="formatDateTimeFull(r.created_at)">{{ formatDateTimeFull(r.created_at) }}</span>
          <span v-if="r.contact" class="sr__contact">Contact: {{ r.contact }}</span>
          <span v-else class="sr__contact sr__contact--none">No contact left</span>
        </header>

        <p class="sr__message">{{ r.message }}</p>

        <details class="sr__tech">
          <summary>Sender details</summary>
          <dl>
            <dt>IP</dt><dd class="mono">{{ r.ip || '–' }}</dd>
            <dt>Browser</dt><dd class="mono">{{ r.user_agent || '–' }}</dd>
            <dt>Report ID</dt><dd class="mono">{{ r.id }}</dd>
          </dl>
        </details>

        <p v-if="r.handled_at" class="sr__handled">
          Handled {{ formatDateTimeFull(r.handled_at) }}
          <template v-if="r.handled_by_profile">by {{ r.handled_by_profile.display_name || r.handled_by_profile.email }}</template>
        </p>
        <p v-if="r.admin_note" class="sr__note">{{ r.admin_note }}</p>

        <div class="sr__actions">
          <template v-if="!r.handled_at">
            <textarea
              v-model="notes[r.id]"
              class="admin-input sr__note-input"
              rows="2"
              maxlength="1000"
              placeholder="What was done (optional), e.g. fixed in PR #123, not reproducible…"
            />
            <button class="btn btn-primary btn-sm" :disabled="busyId === r.id" @click="setHandled(r, true)">
              {{ busyId === r.id ? 'Saving…' : 'Mark handled' }}
            </button>
          </template>
          <button v-else class="btn btn-outline btn-sm" :disabled="busyId === r.id" @click="setHandled(r, false)">
            {{ busyId === r.id ? 'Saving…' : 'Reopen' }}
          </button>
          <p v-if="actionError[r.id]" class="error-text">{{ actionError[r.id] }}</p>
        </div>
      </article>
    </div>

    <div v-if="total > limit" class="admin-pagination">
      <button class="btn btn-outline" :disabled="offset === 0" @click="page(-1)">Previous</button>
      <span>{{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}</span>
      <button class="btn btn-outline" :disabled="offset + limit >= total" @click="page(1)">Next</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { deletionReasonLabel } from '~/utils/deletionReasons'

// TASK-168 — reports sent through the public form (/report, /security).
// TASK-173 — renamed from /admin/security when the form began taking bugs
// too; the old address still works.
definePageMeta({ layout: 'admin', middleware: 'admin', adminLevel: ['super_admin'], alias: ['/admin/security'] })

interface SecurityReport {
  id: string
  kind: 'bug' | 'security' | 'other'
  source: 'form' | 'account_deletion'
  source_detail: string | null
  reporter: { id: string; display_name: string | null; email: string; status: string } | null
  created_at: string
  message: string
  contact: string | null
  user_agent: string | null
  ip: string | null
  handled_at: string | null
  admin_note: string | null
  handled_by_profile: { id: string; display_name: string | null; email: string } | null
}

type Status = 'open' | 'handled' | 'all'
const TABS: { value: Status; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'handled', label: 'Handled' },
  { value: 'all', label: 'All' },
]

type KindFilter = 'all' | 'security' | 'bug' | 'other'
const KIND_TABS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'Any kind' },
  { value: 'security', label: 'Security' },
  { value: 'bug', label: 'Bugs' },
  { value: 'other', label: 'Other' },
]
const KIND_LABELS: Record<string, string> = { security: 'Security', bug: 'Bug', other: 'Other' }

const { authFetch } = useAuthFetch()
const { formatDateTimeFull } = useFormatters()

const reports = ref<SecurityReport[]>([])
const total = ref(0)
const open = ref(0)
const openSecurity = ref(0)
const kind = ref<KindFilter>('all')
const leaversOnly = ref(false)
const status = ref<Status>('open')
const offset = ref(0)
const limit = 50
const loading = ref(true)
const error = ref('')

const notes = reactive<Record<string, string>>({})
const actionError = reactive<Record<string, string>>({})
const busyId = ref<string | null>(null)

async function fetchReports() {
  loading.value = true
  error.value = ''
  try {
    const kindParam = (kind.value === 'all' ? '' : `&kind=${kind.value}`)
      + (leaversOnly.value ? '&source=account_deletion' : '')
    const res = await authFetch<{ reports: SecurityReport[]; total: number; open: number; open_security: number }>(
      `/api/admin/security-reports?status=${status.value}${kindParam}&limit=${limit}&offset=${offset.value}`,
    )
    reports.value = res.reports
    total.value = res.total
    open.value = res.open
    openSecurity.value = res.open_security
  }
  catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to load security reports.'
    reports.value = []
  }
  finally {
    loading.value = false
  }
}

function setStatus(s: Status) {
  status.value = s
  offset.value = 0
  fetchReports()
}

function toggleLeavers() {
  leaversOnly.value = !leaversOnly.value
  offset.value = 0
  fetchReports()
}

function setKind(k: KindFilter) {
  kind.value = k
  offset.value = 0
  fetchReports()
}

function page(dir: 1 | -1) {
  offset.value = Math.max(0, offset.value + dir * limit)
  fetchReports()
}

async function setHandled(r: SecurityReport, handled: boolean) {
  busyId.value = r.id
  actionError[r.id] = ''
  try {
    await authFetch(`/api/admin/security-reports/${r.id}/handle`, {
      method: 'POST',
      body: { handled, note: handled ? notes[r.id] : undefined },
    })
    delete notes[r.id]
    await fetchReports()
  }
  catch (e: any) {
    actionError[r.id] = e?.data?.message || 'Failed to save. Please try again.'
  }
  finally {
    busyId.value = null
  }
}

onMounted(fetchReports)
</script>

<style lang="scss" scoped>
@use './admin-shared';

.sr-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 820px;
}

.sr {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;

  &--handled { opacity: 0.8; }

  // An open security report must not blend in with the bug reports.
  &--security {
    border-color: rgba(229, 62, 62, 0.55);
    box-shadow: inset 3px 0 0 #fc8181;
  }

  &__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.9rem;
    font-size: 0.85rem;
  }

  &__time { color: var(--color-text-muted); }

  &__contact {
    color: var(--color-text);
    overflow-wrap: anywhere;

    &--none { color: var(--color-text-muted); }
  }

  &__message {
    margin: 0;
    color: var(--color-text);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 0.9rem;
  }

  &__tech {
    font-size: 0.8rem;
    color: var(--color-text-muted);

    summary { cursor: pointer; }

    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.25rem 0.75rem;
      margin: 0.5rem 0 0;
    }

    dd { margin: 0; overflow-wrap: anywhere; color: var(--color-text); }
  }

  &__handled {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  &__note {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-left: 2px solid var(--color-border);
    font-size: 0.85rem;
    color: var(--color-text);
    white-space: pre-wrap;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.5rem;
  }

  &__note-input {
    flex: 1 1 320px;
    resize: vertical;
    font: inherit;
  }
}

.kind {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--color-border);
  color: var(--color-text-muted);

  &--security { background: rgba(229, 62, 62, 0.15); color: #fc8181; }
  &--bug { background: rgba(66, 153, 225, 0.15); color: #63b3ed; }
}

.sec-count { color: #fc8181; font-weight: 600; }

.leaver {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: rgba(237, 137, 54, 0.15);
  color: #f6ad55;
}

.sr__reporter {
  font-size: 0.85rem;
  color: var(--color-accent);
  text-decoration: none;
  &:hover { text-decoration: underline; }
}

.filter-sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.25rem;
  background: var(--color-border);
}

.mono {
  font-family: ui-monospace, monospace;
}
</style>
