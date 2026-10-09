<template>
  <section v-if="show" class="wh" aria-label="Wheel of fortune">
    <h3 class="wh__title">Wheel of fortune</h3>

    <p v-if="state?.frozen_until" class="wh__frozen">❄️ Frozen until {{ timeLabel(state.frozen_until) }}</p>

    <!-- The wheel: the wearer spins it, the keyholder watches the spins -->
    <div v-if="showDisc && wheel" class="wh__stage">
      <WheelDisc ref="disc" :segments="wheel.segments" />

      <div v-if="canSpin" class="wh__spin">
        <button type="button" class="wh__btn" :disabled="spinning || waitMs > 0" @click="spin">
          {{ spinning ? 'Spinning…' : 'Spin the wheel' }}
        </button>
        <p v-if="waitMs > 0 && !spinning" class="wh__next">Next spin in {{ countdown }}</p>
      </div>
      <div v-else-if="lastSpin" class="wh__spin">
        <p class="wh__next">
          {{ replaying ? 'Your wearer’s last spin…' : `Last spin ${whenLabel(lastSpin.created_at)}` }}
        </p>
        <button type="button" class="wh__chip" :disabled="replaying" @click="replay">Watch it again</button>
      </div>
      <p v-else class="wh__next">No spins yet.</p>
    </div>

    <Transition name="wh-pop">
      <p v-if="result" class="wh__result" :class="{ 'wh__result--none': !result.applied }" role="status">
        <strong>{{ labelOf(result.segment) }}</strong>
        <span>{{ result.note }}</span>
      </p>
    </Transition>

    <!-- Editor: keyholder, or the wearer of a self-lock -->
    <details v-if="state?.can_edit" class="wh__edit" :open="!wheel">
      <summary>{{ wheel ? 'Edit the wheel' : 'Set up the wheel' }}</summary>

      <p v-if="wheel?.locked_config && role === 'wearer'" class="wh__hint">
        This wheel has been spun, so it is locked: you can only add harder segments or shorten the interval.
      </p>

      <div class="wh__tpl">
        <span>Start from</span>
        <button v-for="(t, key) in WHEEL_TEMPLATES" :key="key" type="button" class="wh__chip" @click="useTemplate(key)">{{ t.label }}</button>
      </div>

      <WheelDisc v-if="draft.length >= 4" :segments="draft" class="wh__preview" />

      <ul class="wh__rows">
        <li v-for="(s, i) in draft" :key="i" class="wh__row">
          <select v-model="s.type" aria-label="Type" @change="onType(s)">
            <option v-for="t in TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
          <select v-if="s.type === 'add' || s.type === 'remove' || s.type === 'freeze'" v-model.number="s.value" aria-label="Amount">
            <option v-for="o in AMOUNTS[s.type]" :key="o.minutes" :value="o.minutes">{{ o.label }}</option>
          </select>
          <input v-else-if="s.type === 'task'" v-model="s.text" type="text" maxlength="140" placeholder="Task" aria-label="Task text">
          <span v-else class="wh__none">no effect</span>
          <select v-model.number="s.weight" aria-label="Chance">
            <option v-for="w in 5" :key="w" :value="w">chance {{ w }}</option>
          </select>
          <button type="button" class="wh__x" aria-label="Remove segment" :disabled="draft.length <= 4" @click="draft.splice(i, 1)">✕</button>
        </li>
      </ul>
      <button type="button" class="wh__chip" :disabled="draft.length >= 12" @click="draft.push({ type: 'add', value: 60, weight: 1 })">+ Segment</button>

      <label class="wh__field">Spin every
        <select v-model.number="interval">
          <option v-for="o in INTERVALS" :key="o.minutes" :value="o.minutes">{{ o.label }}</option>
        </select>
      </label>
      <label class="wh__check"><input v-model="enabled" type="checkbox"> <span>Wheel is on</span></label>

      <button type="button" class="wh__btn wh__btn--small" :disabled="saving || draft.length < 4" @click="save">
        {{ saving ? 'Saving…' : 'Save wheel' }}
      </button>
    </details>

    <ul v-if="state?.spins.length" class="wh__log">
      <li v-for="s in state.spins.slice(0, 5)" :key="s.id">
        <span>{{ labelOf(s.segment) }}</span>
        <time :datetime="s.created_at">{{ whenLabel(s.created_at) }}</time>
      </li>
    </ul>

    <p v-if="error" class="wh__err">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
import { whenLabel } from '~/utils/lockHistory'
import {
  segmentLabel, WHEEL_TEMPLATES, type WheelSegment, type WheelSegmentType,
} from '~/utils/wheel'
import WheelDisc from '~/components/loq/WheelDisc.vue'

const props = defineProps<{ loqId: string; role: 'wearer' | 'keyholder' }>()

interface WheelState {
  enabled: boolean
  segments: WheelSegment[]
  interval_minutes: number
  locked_config: boolean
  next_spin_at: string | null
}
interface Spin { id: string; segment_index: number; segment: WheelSegment; created_at: string }
interface State {
  can_edit: boolean
  wheel: WheelState | null
  spins: Spin[]
  frozen_until: string | null
}
interface SpinResult { segment_index: number; segment: WheelSegment; applied: boolean; note: string; next_spin_at: string }

const TYPES: { value: WheelSegmentType; label: string }[] = [
  { value: 'add', label: 'Add time' },
  { value: 'remove', label: 'Take time off' },
  { value: 'freeze', label: 'Freeze' },
  { value: 'task', label: 'Task' },
  { value: 'nothing', label: 'Nothing' },
]
const m = (minutes: number, label: string) => ({ minutes, label })
const AMOUNTS = {
  add: [m(30, '30m'), m(60, '1h'), m(120, '2h'), m(360, '6h'), m(720, '12h'), m(1440, '24h'), m(4320, '3d'), m(10080, '7d')],
  remove: [m(15, '15m'), m(30, '30m'), m(60, '1h'), m(120, '2h'), m(360, '6h'), m(720, '12h'), m(1440, '24h')],
  freeze: [m(60, '1h'), m(360, '6h'), m(720, '12h'), m(1440, '24h'), m(2880, '48h'), m(4320, '72h')],
}
const INTERVALS = [m(60, '1 hour'), m(360, '6 hours'), m(720, '12 hours'), m(1440, '24 hours'), m(2880, '2 days'), m(10080, '7 days')]

const { authFetch } = useAuthFetch()
const state = ref<State | null>(null)
const draft = ref<WheelSegment[]>([])
const interval = ref(1440)
const enabled = ref(true)
const saving = ref(false)
const error = ref('')
const spinning = ref(false)
const result = ref<SpinResult | null>(null)
const now = ref(Date.now())
const disc = ref<InstanceType<typeof WheelDisc> | null>(null)
const replaying = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const wheel = computed(() => state.value?.wheel ?? null)
// A wearer on a keyholder's lock only sees the card once there is a wheel to spin.
const show = computed(() => !!state.value && (state.value.can_edit || !!wheel.value?.enabled))

const waitMs = computed(() => (wheel.value?.next_spin_at ? Math.max(0, new Date(wheel.value.next_spin_at).getTime() - now.value) : 0))
const countdown = computed(() => {
  const s = Math.ceil(waitMs.value / 1000)
  const h = Math.floor(s / 3600)
  const min = Math.floor((s % 3600) / 60)
  return h ? `${h}h ${String(min).padStart(2, '0')}m` : `${min}m ${String(s % 60).padStart(2, '0')}s`
})

const labelOf = (s: WheelSegment) => segmentLabel(s)
const timeLabel = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })

function adopt(s: State) {
  state.value = s
  if (s.wheel) {
    draft.value = s.wheel.segments.map(x => ({ ...x }))
    interval.value = s.wheel.interval_minutes
    enabled.value = s.wheel.enabled
  }
  else if (!draft.value.length) {
    draft.value = WHEEL_TEMPLATES.gentle.segments.map(x => ({ ...x }))
  }
}

async function load() {
  try {
    adopt(await authFetch<State>(`/api/loqs/${props.loqId}/wheel`))
  }
  catch {
    // Optional feature: without the table or the network the card stays away.
    state.value = null
  }
}

function useTemplate(key: keyof typeof WHEEL_TEMPLATES) {
  draft.value = WHEEL_TEMPLATES[key].segments.map(x => ({ ...x }))
}

function onType(s: WheelSegment) {
  if (s.type === 'add' || s.type === 'remove' || s.type === 'freeze') { s.value = AMOUNTS[s.type][1]!.minutes; delete s.text }
  else if (s.type === 'task') { delete s.value; s.text = s.text ?? '' }
  else { delete s.value; delete s.text }
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    await authFetch(`/api/loqs/${props.loqId}/wheel`, {
      method: 'PUT',
      body: { enabled: enabled.value, interval_minutes: interval.value, segments: draft.value },
    })
    await load()
  }
  catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message ?? 'Could not save the wheel.'
  }
  finally {
    saving.value = false
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function spin() {
  if (!wheel.value || spinning.value) return
  spinning.value = true
  error.value = ''
  result.value = null
  // The wheel starts turning at once; the server draws the result meanwhile.
  // Give it a moment to reach full speed, so even a fast reply still spins.
  disc.value?.spin()
  try {
    const [res] = await Promise.all([
      authFetch<SpinResult>(`/api/loqs/${props.loqId}/wheel/spin`, { method: 'POST' }),
      sleep(700),
    ])
    await disc.value?.land(res.segment_index)
    result.value = res
    await load()
    markSeen()
  }
  catch (e) {
    await disc.value?.stop()
    const err = e as { statusCode?: number; data?: { message?: string; data?: { next_spin_at?: string } } }
    error.value = err.data?.message ?? 'Could not spin the wheel.'
    if (err.statusCode === 429) await load()
  }
  finally {
    spinning.value = false
  }
}

// ─── Showing past spins ────────────────────────────────────────────────────

const canSpin = computed(() => props.role === 'wearer' && !!wheel.value?.enabled)
// The keyholder sees the wheel whenever there is one; the wearer while it is on.
const showDisc = computed(() => !!wheel.value && (props.role === 'keyholder' || canSpin.value))
const lastSpin = computed(() => state.value?.spins[0] ?? null)

/** The last spin's segment on the current wheel, or null when the wheel was edited since. */
const lastIndex = computed(() => {
  const s = lastSpin.value
  const seg = s && wheel.value?.segments[s.segment_index]
  return seg && segmentLabel(seg) === segmentLabel(s.segment) ? s.segment_index : null
})

const seenKey = () => `chasthub:wheel-seen:${props.loqId}`
function wasSeen(id: string): boolean {
  try { return localStorage.getItem(seenKey()) === id }
  catch { return true }
}
function markSeen() {
  try { if (lastSpin.value) localStorage.setItem(seenKey(), lastSpin.value.id) }
  catch { /* private mode: it just replays again next time */ }
}

/** Plays the last spin again on the disc. */
async function replay() {
  if (lastIndex.value === null || replaying.value || spinning.value) return
  replaying.value = true
  disc.value?.spin()
  await sleep(700)
  await disc.value?.land(lastIndex.value)
  replaying.value = false
  markSeen()
}

// First load: the keyholder watches a spin they have not seen yet; otherwise
// the wheel just rests on the last result.
let primed = false
watch(disc, (d) => {
  if (!d || primed) return
  primed = true
  if (lastIndex.value === null) return
  if (props.role === 'keyholder' && lastSpin.value && !wasSeen(lastSpin.value.id)) replay()
  else d.show(lastIndex.value)
})

onMounted(() => {
  load()
  timer = setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<style scoped lang="scss">
.wh {
  margin-top: 12px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(24, 1, 97, 0.6);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__title { margin: 0; font: 700 15px var(--font-display); }
  &__hint { margin: 0; font-size: 13px; color: var(--color-text-muted); }
  &__err { margin: 0; font-size: 13px; color: var(--color-cta); }
  &__frozen { margin: 0; padding: 8px 12px; border-radius: 12px; background: rgba(60, 125, 224, 0.2); font-size: 13px; font-weight: 600; }

  &__stage { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 8px 0; }
  &__spin { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  &__next { margin: 0; font-size: 13px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }

  &__btn {
    padding: 12px 28px;
    border: 0;
    border-radius: 999px;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    font-weight: 700;
    cursor: pointer;

    &:disabled { opacity: 0.5; cursor: default; }
    &--small { align-self: flex-start; padding: 9px 18px; font-size: 13px; }
  }

  &__result {
    margin: 0;
    padding: 12px;
    border-radius: 14px;
    text-align: center;
    background: rgba(var(--color-accent-rgb), 0.16);
    display: flex;
    flex-direction: column;
    gap: 2px;

    strong { font: 700 24px var(--font-display); }
    span { font-size: 13px; color: var(--color-text-muted); }
    &--none { background: var(--color-elevated); }
  }

  &__edit {
    summary { cursor: pointer; font-weight: 700; font-size: 14px; color: var(--color-text-muted); padding: 4px 0; }
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__tpl { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-muted); }
  &__preview { max-width: 200px; }

  &__chip {
    align-self: flex-start;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1.5px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;

    &:disabled { opacity: 0.4; cursor: default; }
  }

  &__rows { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
  &__row { display: grid; grid-template-columns: 1.2fr 1.2fr 1fr auto; gap: 6px; align-items: center; }
  &__none { font-size: 12px; color: var(--color-text-muted); }
  &__x { background: none; border: 0; color: var(--color-text-muted); cursor: pointer; padding: 4px 8px; &:disabled { opacity: 0.3; } }
  &__field { display: flex; align-items: center; gap: 8px; font-size: 14px; }
  &__check { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }

  select, input[type='text'] {
    min-width: 0;
    padding: 7px 8px;
    border-radius: 10px;
    border: 1.5px solid var(--color-border);
    background: rgba(0, 0, 0, 0.2);
    color: var(--color-text);
    font-size: 13px;
  }

  &__log {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;

    li { display: flex; justify-content: space-between; gap: 10px; }
    time { color: var(--color-text-muted); }
  }
}
</style>

<style scoped lang="scss">
// The result pops in once the wheel has stopped.
.wh-pop-enter-active { transition: opacity 0.25s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.wh-pop-leave-active { transition: opacity 0.15s ease; }
.wh-pop-enter-from { opacity: 0; transform: scale(0.85); }
.wh-pop-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .wh-pop-enter-active, .wh-pop-leave-active { transition: none; }
}
</style>
