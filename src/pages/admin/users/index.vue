<template>
  <div class="admin-section">
    <div class="admin-section-header">
      <h1>Users</h1>
      <div class="admin-search">
        <input
          v-model="search"
          type="search"
          placeholder="Search by name, username or email…"
          class="admin-input"
          @input="debouncedFetch"
        />
      </div>
    </div>

    <div class="filter-bar">
      <div v-for="group in filterGroups" :key="group.key" class="filter-group">
        <span class="filter-group__label">{{ group.label }}</span>
        <label v-for="opt in group.options" :key="opt.value" class="admin-toggle">
          <input v-model="group.model.value" type="checkbox" :value="opt.value" @change="reload" />
          <span>{{ opt.label }}</span>
        </label>
      </div>
    </div>

    <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>

    <div v-else-if="error" class="admin-error">⚠️ {{ error }}</div>

    <table v-else class="admin-table admin-table--compact">
      <thead>
        <tr>
          <th>User</th>
          <th>From</th>
          <th>Role</th>
          <th>Subscription</th>
          <th>Status</th>
          <th
            class="th-sort"
            :aria-sort="sortDir === 'asc' ? 'ascending' : 'descending'"
            :title="sortDir === 'asc' ? 'Oldest first, click for newest' : 'Newest first, click for oldest'"
            @click="toggleSort"
          >
            Joined <span class="th-sort__arrow">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
          </th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="user in users"
          :key="user.id"
          class="row--link"
          :class="{ 'row--deleted': user.status === 'deleted' }"
          tabindex="0"
          @click="openProfile(user, $event)"
          @auxclick="openProfile(user, $event)"
          @keydown.enter="openProfile(user, $event)"
        >
          <td>
            <div class="user-cell">
              <UserAvatar
                class="user-cell__avatar"
                :avatar-url="user.avatar_url"
                :display-name="user.display_name || user.username || user.email"
              />
              <span class="user-cell__name">{{ user.display_name || user.username || '–' }}</span>
              <span
                class="user-cell__email"
                :title="user.status === 'deleted' && user.deleted_at ? formatDateTimeFull(user.deleted_at) : undefined"
              >
                {{ user.status === 'deleted' ? deletedNote(user) : user.email }}
              </span>
            </div>
          </td>
          <td :title="originTitle(user)">
            <span v-if="user.signup_country" class="country">{{ user.signup_country }}</span>
            <span v-else class="country country--unknown">–</span>
          </td>
          <td><span class="badge" :class="`badge--${user.role}`">{{ user.role }}</span></td>
          <td>
            <span class="badge" :class="`badge--${user.billing_status}`" :title="billingTitle(user)">
              {{ BILLING_LABELS[user.billing_status] ?? user.billing_status }}
            </span>
          </td>
          <td><span class="badge" :class="`badge--${user.status}`">{{ user.status }}</span></td>
          <td :title="formatDateTimeFull(user.created_at)">{{ formatDate(user.created_at) }}</td>
          <td>
            <button
              v-if="user.status === 'active' && !user.is_admin"
              class="btn btn-danger btn-sm"
              @click="startBan(user)"
            >
              Ban
            </button>
            <button
              v-else-if="user.status === 'banned'"
              class="btn btn-outline btn-sm"
              :disabled="unbanningId === user.id"
              @click="unban(user)"
            >
              {{ unbanningId === user.id ? 'Unbanning…' : 'Unban' }}
            </button>
          </td>
        </tr>
        <tr v-if="users.length === 0">
          <td colspan="7" class="admin-empty">👤 No users found.</td>
        </tr>
      </tbody>
    </table>

    <div v-if="total > limit" class="admin-pagination">
      <button class="btn btn-outline" :disabled="offset === 0" @click="prev">Previous</button>
      <span>{{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}</span>
      <button class="btn btn-outline" :disabled="offset + limit >= total" @click="next">Next</button>
    </div>

    <!-- Ban modal -->
    <div v-if="banTarget" class="modal-overlay" @click.self="banTarget = null">
      <div class="modal">
        <h2>Ban {{ banTarget.email }}?</h2>
        <p class="modal-note">This will end all their relationships and deactivate all locks.</p>
        <textarea v-model="banReason" class="admin-input" rows="3" placeholder="Reason (optional)" />
        <div class="modal-actions">
          <button class="btn btn-outline" @click="banTarget = null">Cancel</button>
          <button class="btn btn-danger" :disabled="banning" @click="confirmBan">
            {{ banning ? 'Banning…' : 'Confirm ban' }}
          </button>
        </div>
        <p v-if="banError" class="error-text">{{ banError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminLevel: ['support', 'super_admin'] })

const { authFetch } = useAuthFetch()
const { formatDate, formatDateTimeFull } = useFormatters()

const users = ref<any[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const route = useRoute()
const router = useRouter()
// Mirrored into ?q= so coming Back from a profile lands on the same results.
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const offset = ref(0)
const limit = 50

// Only Joined is sortable — the other columns hold two or three values each,
// where a filter says what a sort would only imply.
const sortDir = ref<'asc' | 'desc'>('desc')

const roleFilter = ref<string[]>([])
const billingFilter = ref<string[]>([])
// Deleted accounts are anonymized tombstones (TASK-127) — useful on demand,
// noise by default.
const statusFilter = ref<string[]>(['active', 'banned'])

const filterGroups = [
  {
    key: 'role',
    label: 'Role',
    model: roleFilter,
    options: [
      { value: 'loqee', label: 'Wearer' },
      { value: 'loqholder', label: 'Keyholder' },
    ],
  },
  {
    key: 'billing',
    label: 'Subscription',
    model: billingFilter,
    options: [
      { value: 'active', label: 'Active' },
      { value: 'cancelling', label: 'Cancelling' },
      { value: 'past_due', label: 'Past due' },
      { value: 'lapsed', label: 'Lapsed' },
      { value: 'none', label: 'None' },
    ],
  },
  {
    key: 'status',
    label: 'Status',
    model: statusFilter,
    options: [
      { value: 'active', label: 'Active' },
      { value: 'banned', label: 'Banned' },
      { value: 'deleted', label: 'Deleted' },
    ],
  },
]

const BILLING_LABELS: Record<string, string> = {
  active: 'active',
  cancelling: 'cancelling',
  past_due: 'past due',
  lapsed: 'lapsed',
  none: 'none',
}

const banTarget = ref<any | null>(null)
const banReason = ref('')
const banning = ref(false)
const banError = ref('')

const unbanningId = ref<string | null>(null)

let debounceTimer: ReturnType<typeof setTimeout>

function debouncedFetch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    router.replace({ query: { ...route.query, q: search.value || undefined } })
    reload()
  }, 400)
}

async function fetchUsers() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset.value),
      sort: 'created_at',
      dir: sortDir.value,
    })
    if (search.value) params.set('search', search.value)
    if (roleFilter.value.length) params.set('role', roleFilter.value.join(','))
    if (billingFilter.value.length) params.set('billing', billingFilter.value.join(','))
    if (statusFilter.value.length) params.set('status', statusFilter.value.join(','))
    const res = await authFetch<{ users: any[]; total: number }>(`/api/admin/users?${params}`)
    users.value = res.users
    total.value = res.total
  }
  catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to load users.'
    users.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

// Any change to the filters or the sort changes which rows exist, so an offset
// carried over from the previous listing would land on a page that no longer
// means anything.
function reload() {
  offset.value = 0
  fetchUsers()
}

function toggleSort() {
  sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  reload()
}

function prev() { offset.value = Math.max(0, offset.value - limit); fetchUsers() }
function next() { offset.value += limit; fetchUsers() }

// By id, not /user/[username]: most accounts have no username (signup never
// sets one) and that page 404s for banned and deleted users.
function openProfile(user: { id: string }, e: MouseEvent | KeyboardEvent) {
  const url = `/admin/users/${user.id}`
  // The Ban / Unban buttons live in the row too.
  if ((e.target as HTMLElement).closest('button, a, input')) return
  const isMouse = e instanceof MouseEvent
  if (isMouse && e.button > 1) return
  // Middle click and Ctrl/Cmd+click open a tab, as they would on a link.
  if ((isMouse && e.button === 1) || e.ctrlKey || e.metaKey) window.open(url, '_blank')
  else navigateTo(url)
}

// A deleted profile carries `deleted+<uuid>@deleted.chasthub.com` (delete.post.ts),
// which tells an admin nothing. When it was deleted does.
function deletedNote(user: { deleted_at: string | null }) {
  return user.deleted_at ? `deleted ${formatDate(user.deleted_at)}` : 'deleted'
}

// Only the country code is shown — the column has to stay narrow. Region,
// timezone and language go in the tooltip, where they cost no width.
function originTitle(user: {
  signup_country: string | null
  signup_region: string | null
  signup_timezone: string | null
  signup_locale: string | null
}) {
  if (!user.signup_country && !user.signup_timezone && !user.signup_locale) {
    return 'Not recorded. This account predates signup origin being captured'
  }
  const parts = [
    [user.signup_region, user.signup_country].filter(Boolean).join(', '),
    user.signup_timezone,
    user.signup_locale,
  ].filter(Boolean)
  return parts.join(' · ')
}

// The badge is one word; the date that gives it meaning goes in the tooltip.
function billingTitle(user: { billing_status: string; current_period_end: string | null }) {
  const end = user.current_period_end ? formatDateTimeFull(user.current_period_end) : null
  switch (user.billing_status) {
    case 'active': return end ? `Renews ${end}` : 'Active subscription'
    case 'cancelling': return end ? `Cancelled, access until ${end}` : 'Cancels at the end of the period'
    case 'past_due': return end ? `Payment failed, access until ${end}` : 'Payment failed'
    case 'lapsed': return 'Subscribed before, nothing active now'
    case 'none': return 'Never subscribed'
    default: return ''
  }
}

function startBan(user: any) {
  banTarget.value = user
  banReason.value = ''
  banError.value = ''
}

async function confirmBan() {
  if (!banTarget.value) return
  banning.value = true
  banError.value = ''
  try {
    await authFetch(`/api/admin/users/${banTarget.value.id}/ban`, {
      method: 'POST',
      body: { reason: banReason.value || undefined },
    })
    banTarget.value = null
    await fetchUsers()
  }
  catch {
    banError.value = 'Failed to ban user. Please try again.'
  }
  finally {
    banning.value = false
  }
}

async function unban(user: { id: string }) {
  unbanningId.value = user.id
  try {
    await authFetch(`/api/admin/users/${user.id}/unban`, { method: 'POST' })
    await fetchUsers()
  }
  catch { /* leave status as-is; row still shows Unban to retry */ }
  finally {
    unbanningId.value = null
  }
}

onMounted(fetchUsers)
</script>

<style lang="scss" scoped>
@use '../admin-shared';

.user-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;

  &__avatar {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__name {
    font-weight: 600;
    white-space: nowrap;
  }

  // Only the address gives way when the column runs out of room — the name
  // is what an admin scans by.
  &__email {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
}

.row--deleted {
  opacity: 0.55;
}

.row--link {
  cursor: pointer;

  &:hover td,
  &:focus-visible td {
    background: rgba(127, 127, 127, 0.08);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }
}

.country {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.03em;

  &--unknown {
    color: var(--color-text-muted);
  }
}
</style>
