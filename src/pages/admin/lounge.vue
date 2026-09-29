<template>
  <div class="admin-section">
    <div class="admin-section-header">
      <h1>Lounge</h1>
      <span class="text-muted">Opening hours, rules and questions of the Locktober Lounge</span>
    </div>

    <div v-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>
    <div v-else-if="loadError" class="admin-error">⚠️ {{ loadError }}</div>

    <template v-else-if="form">
      <!-- ── State ─────────────────────────────────────────────────────── -->
      <section class="card">
        <div class="state">
          <div>
            <strong>{{ statusLine }}</strong>
            <p class="muted">{{ nextLine }}</p>
          </div>
          <button class="pbtn" :class="form.enabled ? 'pbtn--active' : 'pbtn--primary'" type="button" :disabled="saving" @click="toggleEnabled">
            {{ form.enabled ? 'Turn the Lounge off' : 'Turn the Lounge on' }}
          </button>
        </div>
      </section>

      <!-- ── Settings ──────────────────────────────────────────────────── -->
      <section class="card">
        <h2>Schedule</h2>
        <div class="grid2">
          <label class="field"><span>First day</span><input v-model="form.starts_on" class="admin-input" type="date"></label>
          <label class="field"><span>Last day</span><input v-model="form.ends_on" class="admin-input" type="date"></label>
        </div>

        <p class="muted">Sessions run every day in that range. Times are in the session's own time zone, so daylight saving is handled.</p>
        <div v-for="(s, i) in form.sessions" :key="i" class="sess">
          <input v-model="s.name" class="admin-input" placeholder="Name" maxlength="30">
          <select v-model="s.tz" class="admin-input">
            <option v-for="z in ZONES" :key="z" :value="z">{{ z }}</option>
          </select>
          <input v-model="s.start" class="admin-input" type="time">
          <span>to</span>
          <input v-model="s.end" class="admin-input" placeholder="HH:MM" maxlength="5">
          <button class="pbtn pbtn--sm" type="button" @click="form.sessions.splice(i, 1)">Remove</button>
        </div>
        <button v-if="form.sessions.length < 6" class="pbtn pbtn--sm" type="button" @click="form.sessions.push({ name: 'New', tz: 'Europe/Berlin', start: '19:00', end: '23:00' })">+ Add session</button>

        <h2>Rules</h2>
        <div class="grid2">
          <label class="field"><span>Slow mode (seconds between messages)</span><input v-model.number="form.slow_mode_seconds" class="admin-input" type="number" min="0" max="600"></label>
          <label class="field"><span>Account age before writing (hours)</span><input v-model.number="form.min_account_age_hours" class="admin-input" type="number" min="0" max="720"></label>
        </div>

        <div class="actions">
          <button class="pbtn pbtn--primary" type="button" :disabled="saving" @click="saveSettings">{{ saving ? 'Saving…' : 'Save schedule and rules' }}</button>
          <span v-if="savedMsg" class="ok">{{ savedMsg }}</span>
          <span v-if="saveError" class="err">{{ saveError }}</span>
        </div>
      </section>

      <!-- ── Questions ─────────────────────────────────────────────────── -->
      <section class="card">
        <h2>Question of the day</h2>
        <p class="muted">One per day of the month. Leave a day empty to skip it.</p>
        <div class="qs">
          <label v-for="q in questions" :key="q.day" class="q">
            <span>Day {{ q.day }}</span>
            <input v-model="q.text" class="admin-input" maxlength="200">
          </label>
        </div>
        <div class="actions">
          <button class="pbtn pbtn--primary" type="button" :disabled="savingQ" @click="saveQuestions">{{ savingQ ? 'Saving…' : 'Save questions' }}</button>
          <span v-if="savedQ" class="ok">{{ savedQ }}</span>
          <span v-if="errorQ" class="err">{{ errorQ }}</span>
        </div>
      </section>

      <!-- ── Mutes ─────────────────────────────────────────────────────── -->
      <section class="card">
        <h2>Muted in the Lounge</h2>
        <p v-if="!mutes.length" class="muted">Nobody is muted. Mute people from the ⋯ menu next to their message in the Lounge.</p>
        <table v-else class="admin-table">
          <thead><tr><th>User</th><th>Until</th><th>Reason</th><th /></tr></thead>
          <tbody>
            <tr v-for="m in mutes" :key="m.user_id">
              <td>{{ m.user?.display_name ?? m.user?.email ?? m.user_id }}</td>
              <td>{{ fmt(m.muted_until) }}</td>
              <td>{{ m.reason ?? '' }}</td>
              <td><button class="pbtn pbtn--sm" type="button" @click="unmute(m.user_id)">Unmute</button></td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { LoungeStatus } from '~/types'

definePageMeta({ layout: 'admin', middleware: 'admin', adminLevel: ['support', 'super_admin'] })

interface Session { name: string; tz: string; start: string; end: string }
interface Settings { enabled: boolean; starts_on: string; ends_on: string; sessions: Session[]; slow_mode_seconds: number; min_account_age_hours: number }
interface Mute { user_id: string; muted_until: string; reason: string | null; user: { display_name: string | null; email: string | null } | null }

const ZONES = [
  'Europe/London', 'Europe/Berlin', 'Europe/Helsinki',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Australia/Sydney', 'Asia/Tokyo', 'UTC',
]

const { authFetch } = useAuthFetch()

const loading = ref(true)
const loadError = ref('')
const form = ref<Settings | null>(null)
const status = ref<LoungeStatus | null>(null)
const questions = ref<{ day: number; text: string }[]>([])
const mutes = ref<Mute[]>([])

const saving = ref(false)
const savedMsg = ref('')
const saveError = ref('')
const savingQ = ref(false)
const savedQ = ref('')
const errorQ = ref('')

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const statusLine = computed(() => {
  const s = status.value
  if (!form.value?.enabled) return 'The Lounge is off. Nobody sees it in the menu.'
  if (s?.open) return `Open now: ${s.open.name} session until ${fmt(s.open.end)}`
  return 'On, closed right now'
})
const nextLine = computed(() => {
  const n = status.value?.next
  return n ? `Next: ${n.name} session, ${fmt(n.start)} (your time)` : 'No session planned in the date range.'
})

async function load() {
  loading.value = true
  try {
    const res = await authFetch<{ settings: Settings; status: LoungeStatus; questions: { day: number; text: string }[]; mutes: Mute[] }>('/api/admin/lounge')
    form.value = JSON.parse(JSON.stringify(res.settings))
    status.value = res.status
    const byDay = new Map(res.questions.map(q => [q.day, q.text]))
    questions.value = Array.from({ length: 31 }, (_, i) => ({ day: i + 1, text: byDay.get(i + 1) ?? '' }))
    mutes.value = res.mutes
  }
  catch { loadError.value = 'Could not load the Lounge settings.' }
  finally { loading.value = false }
}

async function patch(body: Partial<Settings>) {
  saving.value = true
  saveError.value = ''
  savedMsg.value = ''
  try {
    await authFetch('/api/admin/lounge', { method: 'PATCH', body })
    const res = await authFetch<{ status: LoungeStatus; settings: Settings }>('/api/admin/lounge')
    status.value = res.status
    form.value = JSON.parse(JSON.stringify(res.settings))
    savedMsg.value = 'Saved'
    setTimeout(() => { savedMsg.value = '' }, 2500)
  }
  catch (err) {
    saveError.value = (err as { data?: { message?: string } })?.data?.message ?? 'Could not save'
  }
  finally { saving.value = false }
}

function toggleEnabled() {
  if (form.value) patch({ enabled: !form.value.enabled })
}

function saveSettings() {
  const f = form.value
  if (!f) return
  patch({
    starts_on: f.starts_on,
    ends_on: f.ends_on,
    sessions: f.sessions.map(s => ({ ...s, start: s.start.slice(0, 5), end: s.end.slice(0, 5) })),
    slow_mode_seconds: f.slow_mode_seconds,
    min_account_age_hours: f.min_account_age_hours,
  })
}

async function saveQuestions() {
  savingQ.value = true
  errorQ.value = ''
  savedQ.value = ''
  try {
    await authFetch('/api/admin/lounge/questions', { method: 'PUT', body: { questions: questions.value } })
    savedQ.value = 'Saved'
    setTimeout(() => { savedQ.value = '' }, 2500)
  }
  catch (err) {
    errorQ.value = (err as { data?: { message?: string } })?.data?.message ?? 'Could not save'
  }
  finally { savingQ.value = false }
}

async function unmute(userId: string) {
  try {
    await authFetch(`/api/lounge/mute/${userId}`, { method: 'DELETE' })
    mutes.value = mutes.value.filter(m => m.user_id !== userId)
  }
  catch { /* stays in the list */ }
}

onMounted(load)
</script>

<style lang="scss" scoped>
@use './admin-shared';
@use '~/assets/styles/profile' as *;

.card {
  max-width: 860px;
  margin-bottom: 1.25rem;
  padding: 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;

  h2 { margin: 0.4rem 0 0; font-size: 1.05rem; }
}

.muted { margin: 0; color: var(--color-text-muted); font-size: 0.85rem; }
.state { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  span { font-size: 0.85rem; font-weight: 600; }
}

.sess {
  display: grid;
  grid-template-columns: 1fr 1.4fr 110px auto 90px auto;
  gap: 0.5rem;
  align-items: center;
  span { color: var(--color-text-muted); font-size: 0.85rem; }
}

.qs { display: flex; flex-direction: column; gap: 0.45rem; }

.q {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 0.6rem;
  align-items: center;
  span { font-size: 0.8rem; color: var(--color-text-muted); }
}

.actions { display: flex; align-items: center; gap: 0.8rem; }
.ok { color: var(--color-success); font-size: 0.85rem; }
.err { color: var(--color-danger); font-size: 0.85rem; }

@media (max-width: 800px) {
  .grid2 { grid-template-columns: 1fr; }
  .sess { grid-template-columns: 1fr 1fr; }
}
</style>
