<template>
  <section v-if="state && visible" class="tk" aria-label="Tasks">
    <div class="tk__head">
      <h3 class="tk__title">{{ state.can_manage && !state.self_lock ? 'Tasks' : 'Your tasks' }}</h3>
      <button v-if="state.can_manage && !formOpen" type="button" class="tk__ghost" @click="formOpen = true">+ New task</button>
    </div>

    <!-- New task -->
    <div v-if="state.can_manage && formOpen" class="tk__form">
      <div class="tk__chips" aria-label="Saved tasks">
        <button v-for="p in PRESETS" :key="p.text" type="button" class="tk__chip" @click="fill(p)">{{ p.text }}</button>
        <span v-for="t in templates" :key="t.id" class="tk__chip tk__chip--saved">
          <button type="button" @click="fill(t)">{{ t.text }}</button>
          <button type="button" class="tk__x" :aria-label="`Remove ${t.text}`" @click="removeTemplate(t.id)">×</button>
        </span>
      </div>

      <textarea v-model="draft.text" class="tk__input" rows="2" maxlength="300" placeholder="What should they do?" aria-label="Task" />

      <div class="tk__row">
        <label class="tk__pen">Deadline
          <select v-model="deadline" class="tk__select">
            <option value="none">None</option>
            <option value="1h">In 1 hour</option>
            <option value="tonight" :disabled="!tonightOk">Today 22:00</option>
            <option value="tomorrow">Tomorrow 22:00</option>
            <option value="custom">Pick…</option>
          </select>
        </label>
        <input v-if="deadline === 'custom'" v-model="customDue" type="datetime-local" class="tk__select" aria-label="Deadline">
        <label class="tk__pen">Proof
          <select v-model="draft.proof" class="tk__select">
            <option value="none">None</option>
            <option value="text">Text</option>
            <option value="photo">Photo</option>
          </select>
        </label>
      </div>

      <div class="tk__row">
        <label v-if="!state.self_lock" class="tk__pen">Reward
          <select v-model.number="draft.reward_minutes" class="tk__select">
            <option v-for="r in REWARDS" :key="r.minutes" :value="r.minutes">{{ r.label }}</option>
          </select>
        </label>
        <label class="tk__pen">Penalty
          <select v-model.number="draft.penalty_minutes" class="tk__select">
            <option v-for="p in PENALTIES" :key="p.minutes" :value="p.minutes">{{ p.label }}</option>
          </select>
        </label>
        <label class="tk__check"><input v-model="saveToLibrary" type="checkbox"> Save to my tasks</label>
      </div>

      <div class="tk__row">
        <button type="button" class="tk__send" :disabled="busy || draft.text.trim().length < 2" @click="create">Give task</button>
        <button type="button" class="tk__ghost" :disabled="busy" @click="formOpen = false">Close</button>
      </div>
    </div>

    <!-- Open tasks -->
    <p v-if="!state.open.length && !formOpen" class="tk__muted">
      {{ state.can_manage ? 'No open tasks.' : 'No tasks right now.' }}
    </p>
    <ul v-if="state.open.length" class="tk__list">
      <li v-for="t in state.open" :key="t.id" class="tk__item">
        <p class="tk__text">{{ t.text }}</p>
        <p class="tk__meta">
          <span v-if="t.due_at" :class="{ 'tk__soon': soon(t.due_at) }">{{ leftLabel(t.due_at) }}</span>
          <span v-if="t.reward_minutes && !state.self_lock">reward -{{ spanMinutes(t.reward_minutes) }}</span>
          <span v-if="t.penalty_minutes">penalty +{{ spanMinutes(t.penalty_minutes) }}</span>
          <span v-if="t.proof !== 'none'">{{ t.proof }} proof</span>
        </p>

        <!-- Wearer -->
        <template v-if="isWearer">
          <p v-if="t.status === 'submitted'" class="tk__muted">Waiting for your keyholder.</p>
          <template v-else-if="active === t.id">
            <textarea v-if="t.proof === 'text'" v-model="proofText" class="tk__input" rows="2" maxlength="1000" placeholder="Proof: what you did" aria-label="Proof" />
            <div class="tk__row">
              <label v-if="t.proof === 'photo'" class="tk__send" :class="{ 'tk__send--busy': busy }">
                {{ busy ? 'Sending…' : 'Take photo' }}
                <input type="file" accept="image/*" capture="environment" class="tk__file" :disabled="busy" @change="onPick($event, t)">
              </label>
              <button v-else type="button" class="tk__send" :disabled="busy || (t.proof === 'text' && proofText.trim().length < 2)" @click="submit(t)">
                {{ busy ? 'Sending…' : 'Send' }}
              </button>
              <button type="button" class="tk__ghost" :disabled="busy" @click="active = ''">Back</button>
            </div>
          </template>
          <button v-else type="button" class="tk__send tk__send--small" @click="active = t.id; proofText = ''">Mark as done</button>
        </template>

        <!-- Keyholder -->
        <template v-if="state.can_manage && !state.self_lock">
          <p v-if="t.proof_text" class="tk__proof">“{{ t.proof_text }}”</p>
          <img v-if="t.photo_url" :src="t.photo_url" alt="Task proof" class="tk__photo">
          <div class="tk__row">
            <button type="button" class="tk__send tk__send--small" :disabled="busy" @click="review(t, 'done')">Done</button>
            <button type="button" class="tk__ghost" :disabled="busy" @click="review(t, 'failed')">Failed</button>
            <button v-if="t.status === 'open'" type="button" class="tk__link" :disabled="busy" @click="withdraw(t)">Withdraw</button>
          </div>
        </template>
        <button v-else-if="state.self_lock && t.status === 'open' && active !== t.id" type="button" class="tk__link" :disabled="busy" @click="withdraw(t)">Withdraw</button>
      </li>
    </ul>

    <ul v-if="state.settled.length" class="tk__done">
      <li v-for="t in state.settled.slice(0, 5)" :key="t.id">
        <span>{{ STATUS[t.status] }} {{ t.text }}</span>
        <small>{{ t.resolved_at ? whenLabel(t.resolved_at) : '' }}</small>
      </li>
    </ul>

    <p v-if="error" class="tk__err">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
import { resizeToJpeg } from '~/utils/resizeImage'
import { spanMinutes, whenLabel } from '~/utils/lockHistory'
import { deadlineFor, tonight, type DeadlineChoice } from '~/utils/taskDeadlines'

const props = defineProps<{ loqId: string; role: 'wearer' | 'keyholder' }>()

type Proof = 'none' | 'text' | 'photo'
interface Task {
  id: string
  text: string
  due_at: string | null
  proof: Proof
  reward_minutes: number
  penalty_minutes: number
  status: 'open' | 'submitted' | 'done' | 'failed' | 'cancelled'
  proof_text: string | null
  photo_url: string | null
  resolved_at: string | null
}
interface State { open: Task[]; settled: Task[]; can_manage: boolean; self_lock: boolean }
interface Template { id?: string; text: string; proof: Proof; reward_minutes: number; penalty_minutes: number }

const PRESETS: Template[] = [
  { text: 'Send a photo of yourself locked', proof: 'photo', reward_minutes: 60, penalty_minutes: 360 },
  { text: 'Write me three lines about how the lock feels today', proof: 'text', reward_minutes: 60, penalty_minutes: 120 },
  { text: 'Drink two litres of water today', proof: 'none', reward_minutes: 30, penalty_minutes: 60 },
  { text: '30 squats, then tell me how it went', proof: 'text', reward_minutes: 60, penalty_minutes: 120 },
  { text: 'Cold shower, no complaining', proof: 'none', reward_minutes: 120, penalty_minutes: 360 },
]
const REWARDS = [0, 30, 60, 120, 360, 720, 1440].map(m => ({ minutes: m, label: m ? `-${spanMinutes(m)}` : 'none' }))
const PENALTIES = [0, 60, 360, 720, 1440, 4320].map(m => ({ minutes: m, label: m ? `+${spanMinutes(m)}` : 'none' }))
const STATUS: Record<string, string> = { done: '✅', failed: '❌', cancelled: '✖️' }

const { authFetch } = useAuthFetch()
const { $supabase } = useNuxtApp()
const state = ref<State | null>(null)
const templates = ref<Template[]>([])
const busy = ref(false)
const error = ref('')
const formOpen = ref(false)
const saveToLibrary = ref(false)
const deadline = ref<DeadlineChoice>('tonight')
const customDue = ref('')
const draft = reactive<Template>({ text: '', proof: 'none', reward_minutes: 60, penalty_minutes: 120 })
const active = ref('')
const proofText = ref('')
const now = ref(Date.now())

const isWearer = computed(() => props.role === 'wearer')
const tonightOk = computed(() => !!tonight(new Date(now.value)))
// A wearer with a keyholder sees the card only once a task exists.
const visible = computed(() => !!state.value && (state.value.can_manage || state.value.open.length > 0 || state.value.settled.length > 0))

watch(tonightOk, (ok) => { if (!ok && deadline.value === 'tonight') deadline.value = 'tomorrow' }, { immediate: true })

const soon = (iso: string) => new Date(iso).getTime() - now.value < 3_600_000
function leftLabel(iso: string) {
  const ms = new Date(iso).getTime() - now.value
  return ms <= 0 ? 'deadline passed' : `${spanMinutes(Math.ceil(ms / 60_000))} left`
}

function fill(t: Template) {
  draft.text = t.text
  draft.proof = t.proof
  draft.reward_minutes = t.reward_minutes
  draft.penalty_minutes = t.penalty_minutes
}

async function load() {
  try {
    state.value = await authFetch<State>(`/api/loqs/${props.loqId}/tasks`)
    if (state.value.can_manage && !state.value.self_lock && !templates.value.length) {
      templates.value = (await authFetch<{ templates: Template[] }>('/api/task-templates')).templates
    }
  }
  catch {
    // Optional card: without the tables or the network it stays hidden.
    state.value = null
  }
}

async function run(fn: () => Promise<unknown>, fallback: string) {
  busy.value = true
  error.value = ''
  try {
    await fn()
    await load()
  }
  catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message ?? fallback
  }
  finally {
    busy.value = false
  }
}

const base = () => `/api/loqs/${props.loqId}/tasks`

const create = () => run(async () => {
  const body = { ...draft, due_at: deadlineFor(deadline.value, customDue.value) }
  await authFetch(base(), { method: 'POST', body })
  if (saveToLibrary.value) {
    const saved = await authFetch<Template>('/api/task-templates', { method: 'POST', body: { ...draft } })
    templates.value = [saved, ...templates.value]
  }
  draft.text = ''
  saveToLibrary.value = false
  formOpen.value = false
}, 'Could not create the task.')

const removeTemplate = (id?: string) => id && run(async () => {
  await authFetch(`/api/task-templates/${id}`, { method: 'DELETE' })
  templates.value = templates.value.filter(t => t.id !== id)
}, 'Could not remove it.')

const submit = (t: Task) => run(async () => {
  await authFetch(`${base()}/${t.id}/submit`, { method: 'POST', body: { proof_text: proofText.value } })
  active.value = ''
}, 'Could not submit.')

const review = (t: Task, decision: 'done' | 'failed') =>
  run(() => authFetch(`${base()}/${t.id}/review`, { method: 'POST', body: { decision } }), 'Could not save.')

const withdraw = (t: Task) => run(() => authFetch(`${base()}/${t.id}`, { method: 'DELETE' }), 'Could not withdraw.')

async function onPick(e: Event, t: Task) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  await run(async () => {
    const photo = await resizeToJpeg(file)
    const { path, token } = await authFetch<{ path: string; token: string }>(`${base()}/${t.id}/upload-url`, { method: 'POST' })
    const { error: upErr } = await $supabase.storage.from('verification-photos').uploadToSignedUrl(path, token, photo, { contentType: 'image/jpeg' })
    if (upErr) throw new Error('Upload failed. Try again.')
    await authFetch(`${base()}/${t.id}/submit`, { method: 'POST', body: {} })
    active.value = ''
  }, 'Could not send the photo.')
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  load()
  timer = setInterval(() => { now.value = Date.now() }, 30_000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped lang="scss">
.tk {
  margin-top: 12px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(24, 1, 97, 0.6);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  &__title { margin: 0; font: 700 15px var(--font-display); }
  &__muted { margin: 0; font-size: 13px; color: var(--color-text-muted); }
  &__err { margin: 0; font-size: 13px; color: var(--color-cta); }

  &__form { display: flex; flex-direction: column; gap: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--color-border); }

  &__chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
  &__chip {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1.5px solid var(--color-border);
    background: transparent;
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;

    button { background: none; border: 0; color: inherit; font: inherit; cursor: pointer; padding: 0; }
    &--saved { border-color: var(--color-accent); color: var(--color-text); }
  }
  &__x { font-size: 14px; line-height: 1; opacity: 0.7; }

  &__input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1.5px solid var(--color-border);
    background: rgba(0, 0, 0, 0.2);
    color: var(--color-text);
    font: inherit;
    font-size: 14px;
    resize: vertical;
  }

  &__row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; font-size: 14px; }
  &__pen { display: inline-flex; align-items: center; gap: 6px; }
  &__check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
  &__select {
    padding: 6px 8px;
    border-radius: 8px;
    border: 1.5px solid var(--color-border);
    background: rgba(0, 0, 0, 0.2);
    color: var(--color-text);
  }

  &__send {
    padding: 10px 20px;
    border: 0;
    border-radius: 999px;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    font-weight: 700;
    cursor: pointer;

    &:disabled, &--busy { opacity: 0.5; cursor: default; }
    &--small { align-self: flex-start; padding: 8px 16px; font-size: 13px; }
  }

  &__ghost {
    padding: 8px 16px;
    border-radius: 999px;
    border: 1.5px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    font-size: 13px;
    cursor: pointer;
  }

  &__link { background: none; border: 0; padding: 0; color: var(--color-text-muted); font-size: 13px; text-decoration: underline; cursor: pointer; align-self: flex-start; }
  &__file { display: none; }

  &__list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
  &__item { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.18); }
  &__text { margin: 0; font-size: 14px; font-weight: 600; }
  &__meta { margin: 0; display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--color-text-muted); }
  &__soon { color: var(--color-cta); font-weight: 700; }
  &__proof { margin: 0; font-size: 13px; font-style: italic; }
  &__photo { width: 100%; max-height: 360px; object-fit: contain; border-radius: 10px; background: rgba(0, 0, 0, 0.3); }

  &__done {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;

    li { display: flex; justify-content: space-between; gap: 10px; }
    span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    small { flex: none; color: var(--color-text-muted); }
  }
}
</style>
