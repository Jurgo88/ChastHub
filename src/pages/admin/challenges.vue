<template>
  <div class="admin-section">
    <div class="admin-section-header">
      <h1>Challenges</h1>
      <span class="text-muted">Shared challenges people join with their lock</span>
    </div>

    <section class="card">
      <h2>New challenge</h2>
      <div class="grid2">
        <label class="field"><span>Title</span><input v-model="form.title" class="admin-input" maxlength="80" @input="suggestSlug"></label>
        <label class="field"><span>Slug (the URL)</span><input v-model="form.slug" class="admin-input" maxlength="60"></label>
      </div>
      <label class="field"><span>Description</span><textarea v-model="form.description" class="admin-input" rows="2" maxlength="500" /></label>

      <div class="modes" role="radiogroup" aria-label="Type">
        <label><input v-model="form.mode" type="radio" value="fixed"> Fixed period</label>
        <label><input v-model="form.mode" type="radio" value="duration"> Length from joining</label>
      </div>

      <div v-if="form.mode === 'fixed'" class="grid2">
        <label class="field"><span>Starts (UTC)</span><input v-model="form.starts" class="admin-input" type="datetime-local"></label>
        <label class="field"><span>Ends (UTC)</span><input v-model="form.ends" class="admin-input" type="datetime-local"></label>
      </div>
      <label v-else class="field"><span>Length in days</span><input v-model.number="form.days" class="admin-input" type="number" min="1" max="365"></label>

      <label class="field"><span>Longest allowed pause (hours)</span><input v-model.number="form.pauseHours" class="admin-input" type="number" min="0" max="168"></label>
      <p class="muted">Joining a fixed challenge is open for its first day. A pause longer than the allowance counts as the lock being off.</p>

      <div class="actions">
        <button class="pbtn pbtn--primary" type="button" :disabled="saving" @click="create">{{ saving ? 'Creating…' : 'Create' }}</button>
        <span v-if="error" class="err">{{ error }}</span>
      </div>
    </section>

    <section class="card">
      <h2>All challenges</h2>
      <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>
      <p v-else-if="!items.length" class="muted">None yet.</p>
      <table v-else class="admin-table">
        <thead><tr><th>Title</th><th>When</th><th>Entries</th><th>Status</th><th /></tr></thead>
        <tbody>
          <tr v-for="c in items" :key="c.id">
            <td><NuxtLink :to="`/challenges/${c.slug}`">{{ c.title }}</NuxtLink></td>
            <td>{{ whenText(c) }}</td>
            <td>{{ c.participants }}</td>
            <td>{{ c.active ? 'Open' : 'Closed' }}</td>
            <td><button class="pbtn pbtn--sm" type="button" @click="toggle(c)">{{ c.active ? 'Close' : 'Reopen' }}</button></td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminLevel: ['support', 'super_admin'] })

interface Item {
  id: string
  slug: string
  title: string
  active: boolean
  starts_at: string | null
  ends_at: string | null
  duration_minutes: number | null
  participants: number
}

const { authFetch } = useAuthFetch()
const items = ref<Item[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const form = reactive({ title: '', slug: '', description: '', mode: 'fixed' as 'fixed' | 'duration', starts: '', ends: '', days: 7, pauseHours: 24 })
let slugTouched = false

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const whenText = (c: Item) => (c.starts_at && c.ends_at ? `${day(c.starts_at)} to ${day(c.ends_at)}` : `${(c.duration_minutes ?? 0) / 1440} days from joining`)

function suggestSlug() {
  if (slugTouched) return
  form.slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}
watch(() => form.slug, (v, old) => { if (v !== old && v !== form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)) slugTouched = true })

async function load() {
  try {
    items.value = (await authFetch<{ challenges: Item[] }>('/api/admin/challenges')).challenges
  }
  finally {
    loading.value = false
  }
}

async function create() {
  saving.value = true
  error.value = ''
  try {
    const body: Record<string, unknown> = {
      slug: form.slug, title: form.title, description: form.description, max_pause_minutes: Math.round(form.pauseHours * 60),
    }
    if (form.mode === 'fixed') {
      // The inputs are read as UTC, so what the admin types is what the challenge uses.
      body.starts_at = form.starts ? `${form.starts}:00Z` : ''
      body.ends_at = form.ends ? `${form.ends}:00Z` : ''
    }
    else {
      body.duration_minutes = Math.round(form.days * 1440)
    }
    await authFetch('/api/admin/challenges', { method: 'POST', body })
    form.title = form.slug = form.description = form.starts = form.ends = ''
    slugTouched = false
    await load()
  }
  catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message ?? 'Could not create the challenge.'
  }
  finally {
    saving.value = false
  }
}

async function toggle(c: Item) {
  await authFetch(`/api/admin/challenges/${c.id}`, { method: 'PATCH', body: { active: !c.active } })
  await load()
}

onMounted(load)
</script>

<style scoped lang="scss">
.card { margin-bottom: 16px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; font-size: 13px; }
.modes { display: flex; gap: 18px; margin-bottom: 12px; }
.muted { color: var(--color-text-muted); font-size: 13px; }
.actions { display: flex; align-items: center; gap: 12px; }
.err { color: var(--color-cta); font-size: 13px; }
</style>
