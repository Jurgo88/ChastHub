<template>
  <div class="admin-section">
    <a href="/admin/users" class="back-link" @click.prevent="goBack">← Users</a>

    <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>

    <div v-else-if="error" class="admin-error">⚠️ {{ error }}</div>

    <template v-else-if="user">
      <header class="user-head" :class="{ 'user-head--deleted': user.status === 'deleted' }">
        <UserAvatar
          class="user-head__avatar"
          :avatar-url="user.avatar_url"
          :display-name="user.display_name || user.username || user.email"
        />
        <div class="user-head__info">
          <h1 class="user-head__name">{{ user.display_name || user.username || '–' }}</h1>
          <p class="user-head__sub">
            <span v-if="user.username">@{{ user.username }}</span>
            <span v-if="user.status !== 'deleted'">{{ user.email }}</span>
          </p>
          <div class="user-head__badges">
            <span class="badge" :class="`badge--${user.role}`">{{ user.role }}</span>
            <span class="badge" :class="`badge--${user.status}`">{{ user.status }}</span>
            <span v-if="user.is_admin" class="badge badge--admin">{{ user.admin_level ?? 'admin' }}</span>
          </div>
        </div>
        <div class="user-head__links">
          <NuxtLink
            v-if="user.status === 'active' && user.username"
            :to="`/user/${user.username}`"
            class="btn btn-outline btn-sm"
          >
            Public profile
          </NuxtLink>
          <!-- TASK-169 — audit_log is super_admin only, like the page. -->
          <NuxtLink
            v-if="authStore.isSuperAdmin"
            :to="{ path: '/admin/audit', query: { user: user.id } }"
            class="btn btn-outline btn-sm"
          >
            Audit log
          </NuxtLink>
          <!-- TASK-171 — same rules as the listing: admins cannot be banned. -->
          <button
            v-if="user.status === 'active' && !user.is_admin"
            class="btn btn-danger btn-sm"
            @click="openBan"
          >
            Ban
          </button>
          <button
            v-else-if="user.status === 'banned'"
            class="btn btn-outline btn-sm"
            :disabled="unbanning"
            @click="unban"
          >
            {{ unbanning ? 'Unbanning…' : 'Unban' }}
          </button>
        </div>
      </header>
      <p v-if="actionError" class="error-text">{{ actionError }}</p>

      <p v-if="user.ban" class="ban-note">
        Banned {{ formatDateTimeFull(user.ban.at) }}<template v-if="user.ban.reason"> — {{ user.ban.reason }}</template>
      </p>

      <p v-if="user.bio" class="bio">{{ user.bio }}</p>

      <div class="cards">
        <section class="card">
          <h2>Account</h2>
          <dl>
            <dt>Joined</dt>
            <dd :title="formatDateTimeFull(user.created_at)">{{ formatDate(user.created_at) }}</dd>
            <dt>Last seen</dt>
            <dd>{{ user.last_seen_at ? formatDateTimeFull(user.last_seen_at) : '–' }}</dd>
            <dt>Terms accepted</dt>
            <dd>{{ user.terms_accepted_at ? formatDateTimeFull(user.terms_accepted_at) : '–' }}</dd>
            <dt>Leaderboard</dt>
            <dd>{{ user.leaderboard_opt_out ? 'opted out' : 'visible' }}</dd>
            <template v-if="user.deleted_at">
              <dt>Deleted</dt>
              <dd>{{ formatDateTimeFull(user.deleted_at) }}</dd>
            </template>
            <dt>User ID</dt>
            <dd class="mono">{{ user.id }}</dd>
          </dl>
        </section>

        <section class="card">
          <h2>Subscription</h2>
          <dl>
            <dt>Status</dt>
            <dd>
              <span class="badge" :class="`badge--${user.billing_status}`">
                {{ user.billing_status.replace('_', ' ') }}
              </span>
            </dd>
            <template v-if="user.current_period_end">
              <dt>{{ user.billing_status === 'active' ? 'Renews' : 'Access until' }}</dt>
              <dd>{{ formatDateTimeFull(user.current_period_end) }}</dd>
            </template>
          </dl>
        </section>

        <section class="card">
          <h2>Locks</h2>
          <dl>
            <dt>As wearer</dt>
            <dd>{{ user.loqs_as_loqee }}</dd>
            <dt>As keyholder</dt>
            <dd>{{ user.loqs_as_loqholder }}</dd>
            <dt>Running now</dt>
            <dd>{{ user.loqs_active }}</dd>
          </dl>
        </section>

        <!-- TASK-171 — from user_activity_days (065): the app on screen. -->
        <section class="card">
          <h2>Activity · last 30 days</h2>
          <template v-if="user.activity_30d">
            <dl>
              <dt>Active days</dt>
              <dd>{{ user.activity_30d.length }}</dd>
              <dt>App opens</dt>
              <dd>{{ user.activity_30d.reduce((n: number, d: any) => n + d.sessions, 0) }}</dd>
            </dl>
            <div class="strip" role="img" :aria-label="`Active on ${user.activity_30d.length} of the last 30 days`">
              <span
                v-for="d in activityStrip"
                :key="d.day"
                class="strip__day"
                :class="{ 'strip__day--on': d.sessions, 'strip__day--untracked': d.untracked }"
                :title="d.untracked ? `${formatDate(d.day)} — before tracking` : `${formatDate(d.day)} — ${d.sessions ? `${d.sessions} app ${d.sessions === 1 ? 'open' : 'opens'}` : 'not active'}`"
              />
            </div>
            <p v-if="!user.activity_tracking_since" class="text-muted">Tracking starts with the next app open.</p>
            <p v-else-if="activityStrip.some(d => d.untracked)" class="text-muted">
              Tracked since {{ formatDate(user.activity_tracking_since) }}.
            </p>
          </template>
          <p v-else class="text-muted">Not available.</p>
        </section>

        <section class="card">
          <h2>Signup origin</h2>
          <dl v-if="user.signup_country || user.signup_timezone || user.signup_locale">
            <dt>Location</dt>
            <dd>{{ [user.signup_region, user.signup_country].filter(Boolean).join(', ') || '–' }}</dd>
            <dt>Timezone</dt>
            <dd>{{ user.signup_timezone || '–' }}</dd>
            <dt>Language</dt>
            <dd>{{ user.signup_locale || '–' }}</dd>
          </dl>
          <p v-else class="text-muted">Not recorded — this account predates signup origin being captured.</p>
        </section>
      </div>

      <!-- TASK-170 — who they have been talking to. Each row opens the chat
           in admin Messages. -->
      <section class="convos">
        <h2 class="convos__title">Conversations</h2>
        <div v-if="convosLoading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>
        <p v-else-if="convosError" class="error-text">{{ convosError }}</p>
        <div v-else-if="convos" class="convos__cols">
          <div>
            <h3>Direct messages · {{ convos.dms.length }}</h3>
            <p v-if="!convos.dms.length" class="text-muted">None.</p>
            <NuxtLink
              v-for="c in convos.dms"
              :key="c.id"
              :to="{ path: '/admin/messages', query: { conversation: c.id } }"
              class="convo"
            >
              <span class="convo__who">{{ c.other?.display_name || c.other?.email || 'Deleted user' }}</span>
              <span class="badge" :class="`badge--${c.status === 'accepted' ? 'active' : c.status === 'pending' ? 'pending' : 'inactive'}`">{{ c.status }}</span>
              <span class="convo__meta">
                {{ c.messages }} {{ c.messages === 1 ? 'message' : 'messages' }}
                · {{ c.last_message_at ? formatDate(c.last_message_at) : `started ${formatDate(c.created_at)}` }}
              </span>
            </NuxtLink>
          </div>
          <div>
            <h3>Lock chats · {{ convos.loqs.length }}</h3>
            <p v-if="!convos.loqs.length" class="text-muted">None.</p>
            <NuxtLink
              v-for="l in convos.loqs"
              :key="l.id"
              :to="{ path: '/admin/messages', query: { loq: l.id } }"
              class="convo"
            >
              <span class="convo__who">
                <template v-if="l.other">{{ l.other.display_name || l.other.email }}</template>
                <template v-else>{{ l.role === 'loqee' ? 'No keyholder' : 'Deleted user' }}</template>
              </span>
              <span class="badge" :class="`badge--${l.status}`">{{ l.status }}</span>
              <span class="convo__meta">
                as {{ l.role }} · {{ l.messages }} {{ l.messages === 1 ? 'message' : 'messages' }} · {{ formatDate(l.created_at) }}
              </span>
            </NuxtLink>
          </div>
        </div>
      </section>
    </template>

    <div v-if="banOpen && user" class="modal-overlay" @click.self="banOpen = false">
      <div class="modal">
        <h2>Ban {{ user.display_name || user.email }}?</h2>
        <p class="modal-note">This will end all their relationships and deactivate all locks.</p>
        <textarea v-model="banReason" class="admin-input" rows="3" placeholder="Reason (optional)" />
        <div class="modal-actions">
          <button class="btn btn-outline" @click="banOpen = false">Cancel</button>
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

const route = useRoute()
const router = useRouter()
const { authFetch } = useAuthFetch()
const authStore = useAuthStore()
const { formatDate, formatDateTimeFull } = useFormatters()

const user = ref<any | null>(null)
const loading = ref(true)
const error = ref('')

// Back to the listing the admin came from, search and all. Opened in a new
// tab there is no such listing, so fall back to a fresh one.
function goBack() {
  if (window.history.state?.back) router.back()
  else navigateTo('/admin/users')
}

interface ConvoPerson { id: string; display_name: string | null; email: string }
interface Convos {
  dms: { id: string; status: string; created_at: string; last_message_at: string | null; other: ConvoPerson | null; messages: number }[]
  loqs: { id: string; status: string; created_at: string; role: 'loqee' | 'loqholder'; other: ConvoPerson | null; messages: number }[]
}

// TASK-170 — loaded alongside the user, but on its own: a failure here must
// not hide the profile.
const convos = ref<Convos | null>(null)
const convosLoading = ref(true)
const convosError = ref('')

async function fetchConvos() {
  try {
    convos.value = await authFetch<Convos>(`/api/admin/users/${route.params.id}/conversations`)
  }
  catch (e: any) {
    convosError.value = e?.data?.message || 'Failed to load conversations.'
  }
  finally {
    convosLoading.value = false
  }
}

async function fetchUser() {
  try {
    user.value = await authFetch(`/api/admin/users/${route.params.id}`)
  }
  catch (e: any) {
    error.value = e?.statusCode === 404 || e?.status === 404
      ? 'User not found.'
      : e?.data?.message || e?.message || 'Failed to load user.'
  }
  finally {
    loading.value = false
  }
}

// TASK-171 — the same endpoints and confirmation as the listing's Ban/Unban.
const banOpen = ref(false)
const banReason = ref('')
const banning = ref(false)
const banError = ref('')
const unbanning = ref(false)
const actionError = ref('')

function openBan() {
  banReason.value = ''
  banError.value = ''
  banOpen.value = true
}

async function confirmBan() {
  banning.value = true
  banError.value = ''
  try {
    await authFetch(`/api/admin/users/${route.params.id}/ban`, {
      method: 'POST',
      body: { reason: banReason.value || undefined },
    })
    banOpen.value = false
    await fetchUser()
  }
  catch (e: any) {
    banError.value = e?.data?.message || 'Failed to ban user. Please try again.'
  }
  finally {
    banning.value = false
  }
}

async function unban() {
  unbanning.value = true
  actionError.value = ''
  try {
    await authFetch(`/api/admin/users/${route.params.id}/unban`, { method: 'POST' })
    await fetchUser()
  }
  catch (e: any) {
    actionError.value = e?.data?.message || 'Failed to unban user. Please try again.'
  }
  finally {
    unbanning.value = false
  }
}

// The last 30 Bratislava days, oldest first, matched against the tracked
// ones. Days before tracking began are marked so they do not read as
// "inactive".
function bratislavaDay(d: Date) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Bratislava' })
}
const activityStrip = computed(() => {
  const tracked = new Map<string, number>((user.value?.activity_30d ?? []).map((d: any) => [d.day, d.sessions]))
  const since = user.value?.activity_tracking_since as string | null
  return Array.from({ length: 30 }, (_, i) => {
    const day = bratislavaDay(new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000))
    return { day, sessions: tracked.get(day) ?? 0, untracked: !since || day < since }
  })
})

onMounted(() => {
  fetchConvos()
  fetchUser()
})
</script>

<style lang="scss" scoped>
@use '../admin-shared';

.back-link {
  display: inline-block;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  text-decoration: none;

  &:hover {
    color: var(--color-text);
  }
}

.user-head {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;

  &--deleted {
    opacity: 0.55;
  }

  &__avatar {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  &__name {
    margin: 0;
    font-size: 1.35rem;
  }

  &__sub {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  &__badges {
    display: flex;
    gap: 0.35rem;
  }

  &__links {
    margin-left: auto;
    display: flex;
    gap: 0.5rem;

    a { text-decoration: none; }
  }
}

.ban-note {
  margin: 1rem 0 0;
  padding: 0.6rem 0.9rem;
  border-radius: 6px;
  background: rgba(229, 62, 62, 0.12);
  color: #fc8181;
  font-size: 0.875rem;
}

.bio {
  margin: 1rem 0 0;
  white-space: pre-line;
  color: var(--color-text);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}

.card {
  padding: 1rem 1.1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);

  h2 {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.4rem 1rem;
    margin: 0;
    font-size: 0.875rem;
  }

  dt {
    color: var(--color-text-muted);
  }

  dd {
    margin: 0;
    color: var(--color-text);
    overflow-wrap: anywhere;
  }
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
}

.strip {
  display: grid;
  grid-template-columns: repeat(30, 1fr);
  gap: 2px;
  margin-top: 0.75rem;

  // Three states that must read apart on the dark card: not tracked yet
  // (barely there), tracked but inactive (grey), active (accent).
  &__day {
    height: 18px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.16);

    &--on { background: var(--color-accent); }
    &--untracked { background: transparent; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07); }
  }
}

.convos {
  margin-top: 1.5rem;

  &__title {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  &__cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 1rem;

    h3 {
      margin: 0 0 0.5rem;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--color-text);
    }
  }
}

.convo {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.15rem 0.75rem;
  padding: 0.6rem 0.75rem;
  margin-bottom: 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-surface);
  text-decoration: none;

  &:hover { border-color: var(--color-accent); }

  &__who {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    grid-column: 1 / -1;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
}
</style>
