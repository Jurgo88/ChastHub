<template>
  <details class="sp" @toggle="onToggle">
    <summary class="sp__sum">Surprises</summary>

    <div v-if="loaded" class="sp__body">
      <p class="sp__hint">
        The app adds (or takes off) time at random moments, and the wearer only finds out when it happens.
      </p>

      <div class="sp__grid">
        <label>Per week
          <select v-model.number="form.per_week" :disabled="saving">
            <option v-for="n in PER_WEEK" :key="n" :value="n">{{ n }}×</option>
          </select>
        </label>
        <label>At least
          <select v-model.number="form.min_minutes" :disabled="saving">
            <option v-for="o in AMOUNTS" :key="o.minutes" :value="o.minutes">{{ o.label }}</option>
          </select>
        </label>
        <label>At most
          <select v-model.number="form.max_minutes" :disabled="saving">
            <option v-for="o in AMOUNTS" :key="o.minutes" :value="o.minutes">{{ o.label }}</option>
          </select>
        </label>
        <label>From
          <select v-model="form.window_start" :disabled="saving">
            <option v-for="h in HOURS" :key="h" :value="clock(h)">{{ clock(h) }}</option>
          </select>
        </label>
        <label>Until
          <select v-model="form.window_end" :disabled="saving">
            <option v-for="h in HOURS" :key="h" :value="clock(h)">{{ clock(h) }}</option>
          </select>
        </label>
      </div>

      <label class="sp__check">
        <input v-model="form.allow_remove" type="checkbox" :disabled="saving">
        <span>Sometimes take time off too</span>
      </label>

      <input
        v-model="form.message"
        class="sp__msg"
        type="text"
        maxlength="140"
        placeholder="Custom message (optional)"
        aria-label="Custom message"
      >

      <div class="sp__actions">
        <button type="button" class="sp__btn" :disabled="saving || !valid" @click="save">
          {{ saving ? 'Saving…' : state?.settings ? 'Save and replan' : 'Turn on' }}
        </button>
        <button v-if="state?.settings" type="button" class="sp__btn sp__btn--ghost" :disabled="saving" @click="turnOff">Turn off</button>
      </div>
      <p v-if="!valid" class="sp__err">The window must end after it starts, and the minimum can't be above the maximum.</p>
      <p v-if="error" class="sp__err">{{ error }}</p>

      <template v-if="state?.upcoming.length">
        <h4 class="sp__h">Planned</h4>
        <ul class="sp__list">
          <li v-for="u in state.upcoming" :key="u.id">
            <span>{{ whenLabel(u.due_at) }}</span>
            <strong :class="u.delta_minutes > 0 ? 'add' : 'rem'">{{ u.delta_minutes > 0 ? '+' : '−' }}{{ spanMinutes(u.delta_minutes) }}</strong>
            <button type="button" class="sp__x" aria-label="Cancel this surprise" @click="cancel(u.id)">✕</button>
          </li>
        </ul>
      </template>

      <template v-if="state?.executed.length">
        <h4 class="sp__h">Done</h4>
        <ul class="sp__list">
          <li v-for="u in state.executed" :key="u.id">
            <span>{{ whenLabel(u.executed_at!) }}</span>
            <strong :class="u.delta_minutes > 0 ? 'add' : 'rem'">{{ u.delta_minutes > 0 ? '+' : '−' }}{{ spanMinutes(u.delta_minutes) }}</strong>
          </li>
        </ul>
      </template>
    </div>
    <p v-else-if="loadError" class="sp__err">{{ loadError }}</p>
  </details>
</template>

<script setup lang="ts">
import { spanMinutes, whenLabel } from '~/utils/lockHistory'

const props = defineProps<{ loqId: string }>()

interface Settings {
  per_week: number
  min_minutes: number
  max_minutes: number
  allow_remove: boolean
  window_start: string
  window_end: string
  message: string | null
}
interface Item { id: string; due_at: string; delta_minutes: number; executed_at?: string }
interface State { settings: Settings | null; upcoming: Item[]; executed: Item[] }

const PER_WEEK = Array.from({ length: 14 }, (_, i) => i + 1)
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const AMOUNTS = [
  { minutes: 15, label: '15m' }, { minutes: 30, label: '30m' }, { minutes: 60, label: '1h' },
  { minutes: 120, label: '2h' }, { minutes: 180, label: '3h' }, { minutes: 360, label: '6h' },
  { minutes: 720, label: '12h' }, { minutes: 1440, label: '24h' },
]
const clock = (h: number) => `${String(h).padStart(2, '0')}:00`

const { authFetch } = useAuthFetch()
const state = ref<State | null>(null)
const loaded = ref(false)
const loadError = ref('')
const saving = ref(false)
const error = ref('')
const form = reactive({
  per_week: 3, min_minutes: 60, max_minutes: 360, allow_remove: false,
  window_start: '08:00', window_end: '22:00', message: '',
})

const valid = computed(() => form.min_minutes <= form.max_minutes && form.window_start < form.window_end)

function adopt(s: State) {
  state.value = s
  if (s.settings) {
    form.per_week = s.settings.per_week
    form.min_minutes = s.settings.min_minutes
    form.max_minutes = s.settings.max_minutes
    form.allow_remove = s.settings.allow_remove
    form.window_start = s.settings.window_start.slice(0, 5)
    form.window_end = s.settings.window_end.slice(0, 5)
    form.message = s.settings.message ?? ''
  }
}

async function load() {
  loadError.value = ''
  try {
    adopt(await authFetch<State>(`/api/loqs/${props.loqId}/surprises`))
    loaded.value = true
  }
  catch {
    loadError.value = 'Could not load surprises.'
  }
}

function onToggle(e: Event) {
  if ((e.target as HTMLDetailsElement).open && !loaded.value) load()
}

async function run(fn: () => Promise<unknown>) {
  saving.value = true
  error.value = ''
  try {
    await fn()
    await load()
  }
  catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message ?? 'Something went wrong.'
  }
  finally {
    saving.value = false
  }
}

const save = () => run(() => authFetch(`/api/loqs/${props.loqId}/surprises`, {
  method: 'PUT',
  body: { ...form, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
}))
const turnOff = () => run(() => authFetch(`/api/loqs/${props.loqId}/surprises`, { method: 'DELETE' }))
const cancel = (id: string) => run(() => authFetch(`/api/loqs/${props.loqId}/surprises/${id}`, { method: 'DELETE' }))
</script>

<style scoped lang="scss">
.sp {
  margin-top: 12px;
  border-top: 1px solid var(--color-border);
  padding-top: 10px;

  &__sum {
    cursor: pointer;
    font: 700 14px var(--font-display);
    color: var(--color-text-muted);
    list-style: none;
    padding: 6px 0;

    &::-webkit-details-marker { display: none; }
    &::before { content: '▸ '; }
  }

  &[open] &__sum::before { content: '▾ '; }

  &__body { display: flex; flex-direction: column; gap: 12px; padding-top: 6px; }
  &__hint { margin: 0; font-size: 13px; color: var(--color-text-muted); }
  &__err { margin: 0; font-size: 13px; color: var(--color-cta); }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
    gap: 8px;

    label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--color-text-muted); }
  }

  select, &__msg {
    padding: 8px 10px;
    border-radius: 10px;
    border: 1.5px solid var(--color-border);
    background: rgba(0, 0, 0, 0.2);
    color: var(--color-text);
    font-size: 14px;
  }

  &__check { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }

  &__actions { display: flex; gap: 8px; flex-wrap: wrap; }

  &__btn {
    padding: 9px 18px;
    border: 0;
    border-radius: 999px;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    font-weight: 700;
    cursor: pointer;

    &:disabled { opacity: 0.5; cursor: default; }
    &--ghost { background: transparent; border: 1.5px solid var(--color-border); color: var(--color-text); }
  }

  &__h { margin: 4px 0 0; font: 700 13px var(--font-display); color: var(--color-text-muted); }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;

    li { display: flex; align-items: center; gap: 10px; font-size: 14px; }
    span { flex: 1; color: var(--color-text-muted); }
    .add { color: var(--color-accent); }
    .rem { color: var(--color-cta); }
  }

  &__x { background: none; border: 0; color: var(--color-text-muted); cursor: pointer; padding: 4px 8px; }
}
</style>
