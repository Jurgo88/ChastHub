<template>
  <section v-if="state && visible" class="vf" aria-label="Verification photos">
    <h3 class="vf__title">Verification photos</h3>

    <!-- Open request, wearer side -->
    <template v-if="isWearer && open">
      <div v-if="open.status === 'pending'" class="vf__due">
        <p class="vf__rule">
          Verification due in <strong>{{ remaining }}</strong>. Write this code on paper and take a photo of yourself with it:
        </p>
        <p class="vf__code" aria-label="Code">{{ open.code }}</p>
        <p v-if="open.penalty_minutes" class="vf__rule">Missing it adds {{ spanMinutes(open.penalty_minutes) }}.</p>
        <label class="vf__send" :class="{ 'vf__send--busy': busy }">
          {{ busy ? 'Sending…' : 'Take photo' }}
          <input type="file" accept="image/*" capture="environment" class="vf__file" :disabled="busy" @change="onPick">
        </label>
      </div>
      <p v-else class="vf__rule">Photo sent. Waiting for your keyholder.</p>
    </template>
    <p v-else-if="isWearer && last" class="vf__rule">{{ lastLine }}</p>
    <p v-else-if="isWearer" class="vf__rule">Nothing requested. If your keyholder asks, the code shows up here.</p>

    <!-- Keyholder side (and a self-lock wearer, who asks themselves) -->
    <template v-if="canManage">
      <div v-if="open?.status === 'submitted'" class="vf__review">
        <p class="vf__rule">Photo for code <strong>{{ open.code }}</strong>:</p>
        <img v-if="open.photo_url" :src="open.photo_url" alt="Verification photo" class="vf__photo">
        <input v-model="note" class="vf__note" type="text" maxlength="200" placeholder="Reason if you reject it (optional)" aria-label="Reason">
        <div class="vf__row">
          <button type="button" class="vf__send vf__send--small" :disabled="busy" @click="review('approve')">Approve</button>
          <button type="button" class="vf__ghost" :disabled="busy" @click="review('reject')">Reject</button>
          <select v-model.number="rejectPenalty" class="vf__select" aria-label="Penalty if rejected" :disabled="busy">
            <option v-for="p in PENALTIES" :key="p.minutes" :value="p.minutes">{{ p.label }}</option>
          </select>
        </div>
      </div>

      <div v-else-if="open?.status === 'pending'" class="vf__row">
        <span class="vf__rule">Waiting for the photo (code {{ open.code }}, due in {{ remaining }}).</span>
        <button type="button" class="vf__ghost" :disabled="busy" @click="cancel">Cancel</button>
      </div>

      <div v-else class="vf__row">
        <label class="vf__pen">Due in
          <select v-model.number="dueMinutes" class="vf__select">
            <option v-for="d in DUES" :key="d.minutes" :value="d.minutes">{{ d.label }}</option>
          </select>
        </label>
        <label class="vf__pen">If missed
          <select v-model.number="penaltyMinutes" class="vf__select">
            <option v-for="p in PENALTIES" :key="p.minutes" :value="p.minutes">{{ p.label }}</option>
          </select>
        </label>
        <button type="button" class="vf__send vf__send--small" :disabled="busy" @click="request">Request verification</button>
      </div>

      <div class="vf__setting">
        <label class="vf__check">
          <input v-model="randomDraft" type="checkbox" :disabled="busy">
          <span>Random daily verification</span>
        </label>
        <template v-if="randomDraft">
          <label class="vf__pen">From <input v-model="startDraft" type="time" class="vf__select"></label>
          <label class="vf__pen">to <input v-model="endDraft" type="time" class="vf__select"></label>
          <label class="vf__pen">Due in
            <select v-model.number="autoDueDraft" class="vf__select">
              <option v-for="d in DUES" :key="d.minutes" :value="d.minutes">{{ d.label }}</option>
            </select>
          </label>
          <label class="vf__pen">If missed
            <select v-model.number="autoPenaltyDraft" class="vf__select">
              <option v-for="p in PENALTIES" :key="p.minutes" :value="p.minutes">{{ p.label }}</option>
            </select>
          </label>
        </template>
        <button type="button" class="vf__send vf__send--small" :disabled="busy || !dirty" @click="saveSettings">Save</button>
      </div>

      <ul v-if="past.length" class="vf__list">
        <li v-for="p in past" :key="p.id">
          <span>{{ statusLabel(p.status) }}<template v-if="p.review_note"> &ndash; {{ p.review_note }}</template></span>
          <small>{{ whenLabel(p.created_at) }}</small>
        </li>
      </ul>
    </template>

    <p v-if="error" class="vf__err">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
import { resizeToJpeg } from '~/utils/resizeImage'
import { spanMinutes, whenLabel } from '~/utils/lockHistory'

const props = defineProps<{ loqId: string; role: 'wearer' | 'keyholder' }>()

interface Item {
  id: string
  code: string
  due_at: string
  penalty_minutes: number
  status: string
  photo_url: string | null
  review_note: string | null
  created_at: string
}
interface State {
  items: Item[]
  open: Item | null
  self_lock: boolean
  settings: { random_daily: boolean; window_start: string; window_end: string; tz: string; due_minutes: number; penalty_minutes: number } | null
}

const DUES = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 120, label: '2 h' },
  { minutes: 360, label: '6 h' },
]
const PENALTIES = [
  { minutes: 0, label: 'no penalty' },
  { minutes: 60, label: '+1h' },
  { minutes: 360, label: '+6h' },
  { minutes: 1440, label: '+24h' },
]

const { authFetch } = useAuthFetch()
const { $supabase } = useNuxtApp()
const state = ref<State | null>(null)
const busy = ref(false)
const error = ref('')
const note = ref('')
const now = ref(Date.now())
const dueMinutes = ref(120)
const penaltyMinutes = ref(0)
const rejectPenalty = ref(0)
const randomDraft = ref(false)
const startDraft = ref('09:00')
const endDraft = ref('21:00')
const autoDueDraft = ref(120)
const autoPenaltyDraft = ref(0)

const isWearer = computed(() => props.role === 'wearer')
const open = computed(() => state.value?.open ?? null)
// A self-lock wearer is both sides; a normal wearer only sends photos.
const canManage = computed(() => props.role === 'keyholder' || !!state.value?.self_lock)
const last = computed(() => state.value?.items[0] ?? null)
const past = computed(() => (state.value?.items ?? []).filter(i => i.status !== 'pending' && i.status !== 'submitted').slice(0, 5))
// The card is noise until verification is in use, unless the keyholder can start it.
const visible = computed(() => canManage.value || !!open.value || !!last.value)

const STATUS: Record<string, string> = {
  approved: 'Approved ✓', rejected: 'Rejected', expired: 'Missed', cancelled: 'Cancelled', pending: 'Waiting for photo', submitted: 'Waiting for review',
}
const statusLabel = (s: string) => STATUS[s] ?? s
const lastLine = computed(() => {
  const l = last.value
  if (!l) return ''
  return `Last verification: ${statusLabel(l.status)}${l.review_note ? ` (${l.review_note})` : ''}`
})

const remaining = computed(() => {
  if (!open.value) return ''
  const ms = new Date(open.value.due_at).getTime() - now.value
  return ms <= 0 ? 'now' : spanMinutes(Math.ceil(ms / 60_000))
})

const dirty = computed(() => {
  const s = state.value?.settings
  if (!s) return randomDraft.value
  return randomDraft.value !== s.random_daily
    || (randomDraft.value && (
      startDraft.value !== s.window_start.slice(0, 5) || endDraft.value !== s.window_end.slice(0, 5)
      || autoDueDraft.value !== s.due_minutes || autoPenaltyDraft.value !== s.penalty_minutes))
})

function adopt(s: State) {
  state.value = s
  if (s.settings) {
    randomDraft.value = s.settings.random_daily
    startDraft.value = s.settings.window_start.slice(0, 5)
    endDraft.value = s.settings.window_end.slice(0, 5)
    autoDueDraft.value = s.settings.due_minutes
    autoPenaltyDraft.value = s.settings.penalty_minutes
  }
}

async function load() {
  try {
    adopt(await authFetch<State>(`/api/loqs/${props.loqId}/verifications`))
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
    error.value = (e as { data?: { message?: string }; message?: string }).data?.message ?? (e as Error).message ?? fallback
  }
  finally {
    busy.value = false
  }
}

const post = (path: string, body?: Record<string, unknown>) =>
  authFetch(`/api/loqs/${props.loqId}/${path}`, { method: 'POST', body })

const request = () => run(() => post('verifications', { due_minutes: dueMinutes.value, penalty_minutes: penaltyMinutes.value }), 'Could not send the request.')
const cancel = () => run(() => post(`verifications/${open.value!.id}/cancel`), 'Could not cancel.')
const review = (decision: 'approve' | 'reject') => run(async () => {
  await post(`verifications/${open.value!.id}/review`, {
    decision, note: note.value, penalty_minutes: decision === 'reject' ? rejectPenalty.value : 0,
  })
  note.value = ''
}, 'Could not save the review.')

const saveSettings = () => run(() => authFetch(`/api/loqs/${props.loqId}/verification-settings`, {
  method: 'PUT',
  body: {
    random_daily: randomDraft.value,
    window_start: startDraft.value,
    window_end: endDraft.value,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    due_minutes: autoDueDraft.value,
    penalty_minutes: autoPenaltyDraft.value,
  },
}), 'Could not save.')

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !open.value) return
  const vid = open.value.id
  await run(async () => {
    const photo = await resizeToJpeg(file)
    const { path, token } = await authFetch<{ path: string; token: string }>(`/api/loqs/${props.loqId}/verifications/${vid}/upload-url`, { method: 'POST' })
    const { error: upErr } = await $supabase.storage.from('verification-photos').uploadToSignedUrl(path, token, photo, { contentType: 'image/jpeg' })
    if (upErr) throw new Error('Upload failed. Try again.')
    await post(`verifications/${vid}/submit`)
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
.vf {
  margin-top: 12px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(24, 1, 97, 0.6);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__title { margin: 0; font: 700 15px var(--font-display); }
  &__rule { margin: 0; font-size: 13px; color: var(--color-text-muted); }
  &__err { margin: 0; font-size: 13px; color: var(--color-cta); }

  &__due, &__review { display: flex; flex-direction: column; gap: 10px; }

  &__code {
    margin: 0;
    font: 700 40px/1 var(--font-display);
    letter-spacing: 0.25em;
    text-align: center;
    padding: 12px 0;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.25);
  }

  &__photo { width: 100%; max-height: 420px; object-fit: contain; border-radius: 12px; background: rgba(0, 0, 0, 0.3); }
  &__file { display: none; }

  &__note {
    width: 100%;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1.5px solid var(--color-border);
    background: rgba(0, 0, 0, 0.2);
    color: var(--color-text);
    font-size: 14px;
  }

  &__send {
    align-self: flex-start;
    padding: 10px 20px;
    border: 0;
    border-radius: 999px;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    font-weight: 700;
    cursor: pointer;

    &:disabled, &--busy { opacity: 0.5; cursor: default; }
    &--small { padding: 8px 16px; font-size: 13px; }
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

  &__row, &__setting { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; font-size: 14px; }
  &__check { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
  &__pen { display: inline-flex; align-items: center; gap: 6px; }

  &__select {
    padding: 6px 8px;
    border-radius: 8px;
    border: 1.5px solid var(--color-border);
    background: rgba(0, 0, 0, 0.2);
    color: var(--color-text);
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;

    li { display: flex; justify-content: space-between; gap: 10px; }
    small { color: var(--color-text-muted); }
  }
}
</style>
