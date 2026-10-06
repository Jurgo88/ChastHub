<template>
  <section v-if="state" class="ci" aria-label="Daily check-in">
    <!-- Wearer -->
    <template v-if="role === 'wearer'">
      <template v-if="!state.checked_in_today">
        <h3 class="ci__title">Daily check-in</h3>
        <p v-if="state.required" class="ci__rule">
          Your keyholder requires it. A missed day adds {{ spanMinutes(state.penalty_minutes) }}.
        </p>
        <div class="ci__moods" role="radiogroup" aria-label="How are you feeling?">
          <button
            v-for="m in MOODS"
            :key="m.key"
            type="button"
            class="ci__mood"
            :class="{ 'ci__mood--on': mood === m.key }"
            role="radio"
            :aria-checked="mood === m.key"
            @click="mood = m.key"
          >
            <span class="ci__emoji">{{ m.emoji }}</span>
            <span>{{ m.key }}</span>
          </button>
        </div>
        <input
          v-model="note"
          class="ci__note"
          type="text"
          maxlength="140"
          placeholder="One line about today (optional)"
          aria-label="Note"
        >
        <button type="button" class="ci__send" :disabled="!mood || sending" @click="submit">
          {{ sending ? 'Sending…' : 'Check in' }}
        </button>
      </template>
      <p v-else class="ci__done">
        <strong>Checked in today ✓</strong>
        <span v-if="state.streak > 0">Day {{ state.streak }} streak 🔥</span>
      </p>
    </template>

    <!-- Keyholder -->
    <template v-else>
      <h3 class="ci__title">Daily check-in</h3>
      <p v-if="state.last" class="ci__last">
        <span class="ci__emoji">{{ emojiFor(state.last.mood) }}</span>
        <span>
          Last: <strong>{{ state.last.mood }}</strong>
          <template v-if="state.last.note"> &ndash; “{{ state.last.note }}”</template>
          <small>{{ state.last.local_date }}</small>
        </span>
      </p>
      <p v-else class="ci__rule">No check-in yet.</p>
      <p v-if="state.streak > 0" class="ci__rule">Streak: {{ state.streak }} {{ state.streak === 1 ? 'day' : 'days' }} 🔥</p>

      <div class="ci__setting">
        <label class="ci__check">
          <input v-model="requiredDraft" type="checkbox" :disabled="saving">
          <span>Make it compulsory</span>
        </label>
        <label v-if="requiredDraft" class="ci__pen">
          Missed day costs
          <select v-model.number="penaltyDraft" :disabled="saving">
            <option v-for="p in PENALTIES" :key="p.minutes" :value="p.minutes">{{ p.label }}</option>
          </select>
        </label>
        <button type="button" class="ci__send ci__send--small" :disabled="saving || !dirty" @click="saveSettings">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </template>

    <p v-if="error" class="ci__err">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
import { spanMinutes } from '~/utils/lockHistory'

const props = defineProps<{ loqId: string; role: 'wearer' | 'keyholder' }>()

interface CheckinState {
  today: string
  checked_in_today: boolean
  streak: number
  required: boolean
  penalty_minutes: number
  last: { mood: string; note: string | null; local_date: string } | null
}

const MOODS = [
  { key: 'calm', emoji: '😌' },
  { key: 'teased', emoji: '😏' },
  { key: 'struggling', emoji: '😣' },
  { key: 'desperate', emoji: '🥵' },
  { key: 'proud', emoji: '😇' },
]
const PENALTIES = [
  { minutes: 60, label: '+1h' },
  { minutes: 120, label: '+2h' },
  { minutes: 360, label: '+6h' },
  { minutes: 1440, label: '+24h' },
]
const emojiFor = (mood: string) => MOODS.find(m => m.key === mood)?.emoji ?? '📝'

const { authFetch } = useAuthFetch()
const state = ref<CheckinState | null>(null)
const mood = ref('')
const note = ref('')
const sending = ref(false)
const saving = ref(false)
const error = ref('')
const requiredDraft = ref(false)
const penaltyDraft = ref(120)

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone

const dirty = computed(() => {
  if (!state.value) return false
  if (requiredDraft.value !== state.value.required) return true
  return requiredDraft.value && penaltyDraft.value !== state.value.penalty_minutes
})

function adopt(s: CheckinState) {
  state.value = s
  requiredDraft.value = s.required
  penaltyDraft.value = s.penalty_minutes || 120
}

async function load() {
  try {
    adopt(await authFetch<CheckinState>(`/api/loqs/${props.loqId}/checkins`, { query: { tz: tz() } }))
  }
  catch {
    // The card is optional: without the table or the network it just stays hidden.
    state.value = null
  }
}

async function submit() {
  if (!mood.value || sending.value) return
  sending.value = true
  error.value = ''
  try {
    await authFetch(`/api/loqs/${props.loqId}/checkin`, { method: 'POST', body: { mood: mood.value, note: note.value, tz: tz() } })
    mood.value = ''
    note.value = ''
    await load()
  }
  catch (e) {
    const err = e as { statusCode?: number; data?: { message?: string } }
    error.value = err.data?.message ?? 'Could not check in.'
    if (err.statusCode === 409) await load()
  }
  finally {
    sending.value = false
  }
}

async function saveSettings() {
  saving.value = true
  error.value = ''
  try {
    await authFetch(`/api/loqs/${props.loqId}/checkin-settings`, {
      method: 'POST',
      body: { required: requiredDraft.value, penalty_minutes: penaltyDraft.value },
    })
    await load()
  }
  catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message ?? 'Could not save.'
  }
  finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.ci {
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

  &__moods { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }

  &__mood {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 2px;
    border-radius: 12px;
    border: 1.5px solid var(--color-border);
    background: transparent;
    color: var(--color-text-muted);
    font-size: 10px;
    cursor: pointer;
    touch-action: manipulation;

    &--on { border-color: var(--color-accent); color: var(--color-text); background: rgba(var(--color-accent-rgb), 0.16); }
  }

  &__emoji { font-size: 22px; line-height: 1; }

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

    &:disabled { opacity: 0.5; cursor: default; }
    &--small { padding: 8px 16px; font-size: 13px; }
  }

  &__done { margin: 0; display: flex; flex-direction: column; gap: 2px; font-size: 14px; span { color: var(--color-text-muted); } }

  &__last { margin: 0; display: flex; align-items: center; gap: 10px; font-size: 14px; small { display: block; color: var(--color-text-muted); } }

  &__setting { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; font-size: 14px; }
  &__check { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
  &__pen select {
    margin-left: 6px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1.5px solid var(--color-border);
    background: rgba(0, 0, 0, 0.2);
    color: var(--color-text);
  }
}
</style>
