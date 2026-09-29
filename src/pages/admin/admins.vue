<template>
  <div class="admin-section">
    <div class="admin-section-header">
      <h1>Admins</h1>
    </div>

    <form class="invite-form" @submit.prevent="invite">
      <input
        v-model="inviteEmail"
        type="email"
        required
        placeholder="Email address"
        class="admin-input"
      />
      <select v-model="inviteLevel" class="admin-input admin-select">
        <option value="super_admin">Super admin</option>
        <option value="support">Support</option>
        <option value="analyst">Analyst</option>
      </select>
      <button class="btn btn-primary" type="submit" :disabled="inviting">
        {{ inviting ? 'Inviting…' : 'Invite admin' }}
      </button>
    </form>
    <p v-if="inviteError" class="error-text">{{ inviteError }}</p>
    <p v-if="inviteSuccess" class="success-text">{{ inviteSuccess }}</p>

    <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>

    <table v-else class="admin-table">
      <thead>
        <tr>
          <th>Email</th>
          <th>Level</th>
          <th>Added</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="admin in admins" :key="admin.id">
          <td>{{ admin.email }}</td>
          <td><span class="badge" :class="`badge--${admin.admin_level}`">{{ admin.admin_level }}</span></td>
          <td :title="formatDateTimeFull(admin.created_at)">{{ formatDate(admin.created_at) }}</td>
          <td>
            <button
              class="btn btn-outline btn-sm"
              :disabled="demotingId === admin.id"
              @click="demote(admin)"
            >
              {{ demotingId === admin.id ? 'Removing…' : 'Remove access' }}
            </button>
          </td>
        </tr>
        <tr v-if="admins.length === 0">
          <td colspan="4" class="admin-empty">🛡️ No admins found.</td>
        </tr>
      </tbody>
    </table>
    <p v-if="demoteError" class="error-text">{{ demoteError }}</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminLevel: ['super_admin'] })

const { authFetch } = useAuthFetch()
const { formatDate, formatDateTimeFull } = useFormatters()

const admins = ref<any[]>([])
const loading = ref(true)

const inviteEmail = ref('')
const inviteLevel = ref<'super_admin' | 'support' | 'analyst'>('support')
const inviting = ref(false)
const inviteError = ref('')
const inviteSuccess = ref('')

const demotingId = ref<string | null>(null)
const demoteError = ref('')

async function fetchAdmins() {
  loading.value = true
  try {
    const res = await authFetch<{ admins: any[] }>('/api/admin/admins')
    admins.value = res.admins
  }
  finally {
    loading.value = false
  }
}

async function invite() {
  inviting.value = true
  inviteError.value = ''
  inviteSuccess.value = ''
  try {
    const res = await authFetch<{ promoted: boolean }>('/api/admin/admins', {
      method: 'POST',
      body: { email: inviteEmail.value, admin_level: inviteLevel.value },
    })
    // TASK-181 — an existing member is promoted in place; nobody is invited.
    inviteSuccess.value = res.promoted
      ? `${inviteEmail.value} is now an admin.`
      : `Invite sent to ${inviteEmail.value}.`
    inviteEmail.value = ''
    await fetchAdmins()
  }
  catch (e: any) {
    // The server says why (already an admin, banned, unfinished signup…);
    // a generic "try again" hid that and made retrying pointless.
    inviteError.value = e?.data?.message || 'Failed to invite admin. Please try again.'
  }
  finally {
    inviting.value = false
  }
}

async function demote(admin: { id: string; email: string }) {
  demoteError.value = ''
  demotingId.value = admin.id
  try {
    await authFetch(`/api/admin/admins/${admin.id}/demote`, { method: 'POST' })
    await fetchAdmins()
  }
  catch {
    demoteError.value = 'Failed to remove admin access.'
  }
  finally {
    demotingId.value = null
  }
}

onMounted(fetchAdmins)
</script>

<style lang="scss" scoped>
@use './admin-shared';

.invite-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;

  .admin-input {
    width: auto;
    flex: 1;
    min-width: 220px;
  }
}

.admin-select {
  cursor: pointer;
}

.badge--super_admin { background: rgba(229, 62, 62, 0.15); color: #fc8181; }
.badge--support { background: rgba(66, 153, 225, 0.15); color: #63b3ed; }
.badge--analyst { background: rgba(var(--color-accent-rgb), 0.15); color: var(--color-accent); }

.success-text {
  color: #68d391;
  font-size: 0.875rem;
  margin: 0;
}
</style>
