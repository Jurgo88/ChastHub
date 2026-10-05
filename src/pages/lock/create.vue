<template>
  <div class="create-page">
    <div class="create-glow" aria-hidden="true" />

    <header class="create-nav">
      <button v-if="step > 1" type="button" class="create-nav__back" @click="prevStep">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        Back
      </button>
      <NuxtLink v-else to="/dashboard/wearer" class="create-nav__back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        Dashboard
      </NuxtLink>
      <ol class="steps" aria-label="Steps">
        <li v-for="(n, i) in STEP_NAMES" :key="n" :class="{ on: step === i + 1, done: step > i + 1 }">
          <i>{{ step > i + 1 ? '✓' : i + 1 }}</i><span>{{ n }}</span>
        </li>
      </ol>
    </header>

    <div class="create-grid">
      <main class="create-main">

        <!-- Step 1: Time -->
        <section v-if="step === 1" class="create-step">
          <h1 class="create-step__title">How long?</h1>
          <p class="create-step__hint">The clock starts the moment you lock.</p>

          <button
            v-if="october"
            type="button"
            class="lt-card"
            :class="{ 'lt-card--on': choiceId === 'l30' }"
            :aria-pressed="choiceId === 'l30'"
            @click="choiceId = 'l30'"
          >
            <span class="lt-card__ico" aria-hidden="true">🔒</span>
            <span class="lt-card__txt">
              <b>Locktober 30</b>
              <small>30 days, ends {{ fmtEnd(addMinutes(now, LOCKTOBER_30_MINUTES)) }}. Counts for the Locktober 30 board.</small>
            </span>
            <span class="lt-card__chk" aria-hidden="true">✓</span>
          </button>

          <p class="lbl">Quick picks</p>
          <div class="duration-grid">
            <button
              v-for="p in presets"
              :key="p.id"
              class="duration-chip"
              :class="{ 'duration-chip--active': choiceId === p.id }"
              type="button"
              @click="choiceId = p.id"
            >
              {{ p.label }}
              <small v-if="p.id === 'weekend'">Mon 8:00</small>
              <small v-else-if="p.id === 'nov1'">00:00</small>
            </button>
          </div>

          <p class="lbl">Or set your own</p>
          <div class="seg" role="tablist" aria-label="Custom time">
            <button class="seg__btn" :class="{ 'seg__btn--on': choiceId === 'custom' && customMode === 'duration' }" type="button" role="tab" @click="pickCustom('duration')">Duration</button>
            <button class="seg__btn" :class="{ 'seg__btn--on': choiceId === 'custom' && customMode === 'until' }" type="button" role="tab" @click="pickCustom('until')">Until a date</button>
          </div>

          <div v-if="choiceId === 'custom' && customMode === 'duration'" class="custom-block custom-block--active">
            <div class="custom-block__spinners">
              <div v-for="sp in spinners" :key="sp.key" class="dur-spin">
                <button class="dur-spin__arrow" type="button" :aria-label="`More ${sp.label}`" :disabled="custom[sp.key] >= sp.max" @click="spin(sp.key, 1, sp.max)">
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M2 9l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </button>
                <span class="dur-spin__val">{{ String(custom[sp.key]).padStart(2, '0') }}</span>
                <button class="dur-spin__arrow" type="button" :aria-label="`Fewer ${sp.label}`" :disabled="custom[sp.key] <= 0" @click="spin(sp.key, -1, sp.max)">
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M2 5l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </button>
                <span class="dur-spin__label">{{ sp.label }}</span>
              </div>
            </div>
          </div>

          <div v-if="choiceId === 'custom' && customMode === 'until'" class="until">
            <label><span>Date</span><input v-model="untilDate" type="date" class="create-input" :min="todayIso"></label>
            <label><span>Time</span><input v-model="untilTime" type="time" class="create-input"></label>
          </div>

          <p v-if="minutes" class="create-preview">
            <strong>{{ formatMinutes(minutes) }}</strong> · ends {{ fmtEnd(endsAt) }}
          </p>
          <p v-else-if="choiceId === 'custom'" class="create-input-meta create-input-meta--left">Pick a time in the future.</p>

          <div class="create-actions">
            <button class="btn btn--primary" :disabled="!minutes" @click="nextStep">Continue</button>
          </div>
        </section>

        <!-- Step 2: Key -->
        <section v-if="step === 2" class="create-step">
          <h1 class="create-step__title">Hide your key</h1>
          <p class="create-step__hint">Set your padlock to this code. It stays hidden from you until the lock ends.</p>

          <div class="seg" role="tablist" aria-label="Combination type">
            <button class="seg__btn" :class="{ 'seg__btn--on': comboMode === 'text' }" type="button" role="tab" :aria-selected="comboMode === 'text'" @click="comboMode = 'text'">Code</button>
            <button class="seg__btn" :class="{ 'seg__btn--on': comboMode === 'photo' }" type="button" role="tab" :aria-selected="comboMode === 'photo'" @click="comboMode = 'photo'">Photo</button>
          </div>

          <template v-if="comboMode === 'text'">
            <div class="code-row">
              <label class="sr-only" for="combo-text">Combination</label>
              <input
                id="combo-text"
                v-model.trim="form.combination_text"
                type="text"
                class="create-input create-input--code"
                maxlength="10"
                placeholder="1234"
                autocomplete="off"
              >
              <button type="button" class="gen" @click="form.combination_text = randomCode()">🎲 New</button>
            </div>
            <p class="create-input-meta create-input-meta--left">Generated for you. Type your own if you prefer. {{ form.combination_text.length }}/10</p>
          </template>

          <template v-else>
            <div class="photo-upload" :class="{ 'photo-upload--filled': !!photoPreview }" @click="triggerFileInput" @dragover.prevent @drop.prevent="onPhotoDrop">
              <img v-if="photoPreview" :src="photoPreview" class="photo-upload__preview" alt="Combination preview">
              <template v-else>
                <svg class="photo-upload__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                <p class="photo-upload__hint">Tap to take or choose a photo</p>
                <p class="photo-upload__sub">or drag it here</p>
              </template>
              <input ref="fileInputRef" type="file" accept="image/*" class="photo-upload__input" @change="onFileChange">
            </div>
            <p v-if="uploadError" class="create-error">{{ uploadError }}</p>
            <p v-if="uploading" class="create-input-meta">Uploading…</p>
            <p v-else-if="form.combination_photo_url" class="create-input-meta create-input-meta--ok">Photo ready</p>
          </template>

          <div class="tip"><b>Tip:</b> set the code, close the lock, then scramble the dials before you continue. You will not see it again until the end.</div>

          <p v-if="errors.combination" class="create-error">{{ errors.combination }}</p>
          <div class="create-actions">
            <button class="btn btn--primary" :disabled="!combinationReady || uploading" @click="nextStep">Continue</button>
          </div>
        </section>

        <!-- Step 3: Start -->
        <section v-if="step === 3" class="create-step">
          <h1 class="create-step__title">Who holds the key?</h1>

          <div class="start-list" role="radiogroup" aria-label="How do you want to start?">
            <button
              v-for="o in START_OPTIONS"
              :key="o.id"
              type="button"
              role="radio"
              class="sc"
              :class="{ 'sc--on': startMode === o.id }"
              :aria-checked="startMode === o.id"
              @click="startMode = o.id"
            >
              <i aria-hidden="true">{{ o.icon }}</i>
              <span><b>{{ o.title }}</b><small>{{ o.text }}</small></span>
            </button>
          </div>

          <div v-if="startMode === 'self'" class="vis">
            <h4>Visitors on your link can</h4>
            <div class="pills">
              <button v-for="p in PERMS" :key="p.id" type="button" :class="{ on: visitorPermission === p.id }" @click="visitorPermission = p.id">{{ p.label }}</button>
            </div>
            <template v-if="visitorPermission !== 'none'">
              <h4>Each click moves the clock by</h4>
              <div class="pills">
                <button v-for="h in HOURS" :key="h" type="button" :class="{ on: visitorHours === h }" @click="visitorHours = h">{{ h }}h</button>
              </div>
            </template>
            <label class="tg">
              <span>Show my lock in Key Drop</span>
              <input v-model="listed" type="checkbox" class="sw">
            </label>
          </div>

          <button type="button" class="more" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen">
            <span>{{ form.emotion || form.reason ? 'Mood and note' : 'Add a mood or a note' }}</span>
            <span aria-hidden="true">{{ moreOpen ? '−' : '＋' }}</span>
          </button>
          <div v-if="moreOpen" class="more-body">
            <div class="emotion-grid">
              <button
                v-for="e in EMOTIONS"
                :key="e.emoji"
                class="emotion-btn"
                :class="{ 'emotion-btn--active': form.emotion === e.emoji }"
                type="button"
                :aria-pressed="form.emotion === e.emoji"
                @click="toggleEmotion(e.emoji)"
              >
                <span class="emotion-btn__emoji">{{ e.emoji }}</span>
                <span class="emotion-btn__label">{{ e.label }}</span>
              </button>
              <label class="emotion-btn emotion-btn--custom" :class="{ 'emotion-btn--active': !!customEmotion && form.emotion === customEmotion }">
                <input v-model="customEmotion" class="emotion-btn__input" type="text" maxlength="8" placeholder="＋" aria-label="Custom emoji" @input="form.emotion = customEmotion.trim()">
                <span class="emotion-btn__label">your own</span>
              </label>
            </div>
            <label class="sr-only" for="lock-note">Note</label>
            <textarea id="lock-note" v-model.trim="form.reason" class="create-textarea" maxlength="100" rows="2" placeholder="First Locktober. Be gentle… or don't." />
            <p class="create-input-meta">{{ form.reason.length }}/100</p>
          </div>

          <p v-if="submitError" class="create-error">{{ submitError }}</p>
          <NuxtLink v-if="showUpgradeCta" to="/subscription/upgrade" class="create-upgrade-cta">See plans →</NuxtLink>
          <div class="create-actions create-actions--col">
            <button class="btn btn--primary btn--lock" :disabled="submitting || !minutes" @click="submit">
              {{ submitting ? 'Locking…' : `🔒 ${lockLabel}` }}
            </button>
            <p class="create-input-meta create-input-meta--center">{{ footLine }}</p>
          </div>
        </section>
      </main>

      <aside class="sum" aria-label="Your lock">
        <h3>Your lock</h3>
        <div class="sum__ring">
          <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
            <circle cx="28" cy="28" r="23" fill="none" stroke="#34138A" stroke-width="7" />
            <circle cx="28" cy="28" r="23" fill="none" stroke="url(#sumg)" stroke-width="7" stroke-linecap="round" :stroke-dasharray="`${ringDash} 145`" transform="rotate(-90 28 28)" />
            <defs><linearGradient id="sumg"><stop offset="0" stop-color="#EB3678" /><stop offset="1" stop-color="#FB773C" /></linearGradient></defs>
          </svg>
          <div>
            <b>{{ minutes ? formatMinutes(minutes) : 'No time yet' }}</b>
            <small v-if="minutes">Ends {{ fmtEnd(endsAt) }}</small>
          </div>
        </div>
        <div v-if="countsFor" class="sum__row"><span>Counts for</span><b>{{ countsFor }}</b></div>
        <div class="sum__row"><span>Key</span><b :class="{ todo: step < 2 }">{{ keyLine }}</b></div>
        <div class="sum__row"><span>Holds the key</span><b :class="{ todo: step < 3 }">{{ step < 3 ? 'Step 3' : holderLine }}</b></div>
        <div class="sum__row"><span>Visitors</span><b :class="{ todo: step < 3 }">{{ step < 3 ? 'Step 3' : visitorsLine }}</b></div>
        <div v-if="form.emotion" class="sum__row"><span>Mood</span><b>{{ form.emotion }}</b></div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { uploadCombinationPhoto } from '~/composables/useLoq'
import {
  presetsFor, choiceMinutes, formatMinutes, randomCode, isOctober,
  LOCKTOBER_30_MINUTES, MAX_LOCK_DAYS, type TimeChoice,
} from '~/utils/lockDuration'

definePageMeta({ middleware: ['auth', 'subscription'] })

const router = useRouter()
const { createLoq, publishLoq } = useLoq()

const STEP_NAMES = ['Time', 'Key', 'Start']

type StartMode = 'invite' | 'keydrop' | 'self'
const START_OPTIONS: { id: StartMode; icon: string; title: string; text: string }[] = [
  { id: 'invite', icon: '🤝', title: 'Invite a keyholder', text: 'Pick someone by name. They accept and take over the timer.' },
  { id: 'keydrop', icon: '🔑', title: 'Drop it in Key Drop', text: 'Your lock goes public and a keyholder can claim it.' },
  { id: 'self', icon: '🔒', title: 'Lock myself', text: 'You hold the timer. Share your link and let visitors decide.' },
]

type Perm = 'none' | 'add' | 'remove' | 'both'
const PERMS: { id: Perm; label: string }[] = [
  { id: 'add', label: 'Only add' },
  { id: 'both', label: 'Add or remove' },
  { id: 'remove', label: 'Only remove' },
  { id: 'none', label: 'Just watch' },
]
const HOURS = [1, 2, 4, 8]

const EMOTIONS = [
  { label: 'excited', emoji: '🤭' },
  { label: 'chill', emoji: '😅' },
  { label: 'weak', emoji: '😵' },
  { label: 'nervous', emoji: '🥺' },
  { label: 'hopeless', emoji: '😭' },
] as const

// ── Time ────────────────────────────────────────────────────────────────────
const now = ref(new Date())
let tick: ReturnType<typeof setInterval> | undefined
onMounted(() => { tick = setInterval(() => { now.value = new Date() }, 30_000) })
onBeforeUnmount(() => clearInterval(tick))

const october = computed(() => isOctober(now.value))
const presets = computed(() => presetsFor(now.value))
const choiceId = ref<string>(isOctober(new Date()) ? 'l30' : '1d')
const customMode = ref<'duration' | 'until'>('duration')
const custom = reactive({ d: 0, h: 0, m: 0 })
const spinners = [
  { key: 'd' as const, label: 'Days', max: MAX_LOCK_DAYS },
  { key: 'h' as const, label: 'Hours', max: 23 },
  { key: 'm' as const, label: 'Min', max: 59 },
]

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const todayIso = computed(() => isoDate(now.value))
const untilDate = ref(isoDate(new Date(Date.now() + 7 * 86_400_000)))
const untilTime = ref('20:00')

function pickCustom(mode: 'duration' | 'until') {
  // Carry the current pick over so switching to "Duration" starts from it.
  if (mode === 'duration' && choiceId.value !== 'custom' && minutes.value) {
    custom.d = Math.floor(minutes.value / 1440)
    custom.h = Math.floor((minutes.value % 1440) / 60)
    custom.m = minutes.value % 60
  }
  customMode.value = mode
  choiceId.value = 'custom'
}

function spin(key: 'd' | 'h' | 'm', delta: number, max: number) {
  custom[key] = Math.max(0, Math.min(max, custom[key] + delta))
}

function choiceAt(at: Date): TimeChoice | null {
  if (choiceId.value === 'l30') return { kind: 'minutes', minutes: LOCKTOBER_30_MINUTES }
  if (choiceId.value === 'custom') {
    if (customMode.value === 'duration') return { kind: 'minutes', minutes: custom.d * 1440 + custom.h * 60 + custom.m }
    const t = new Date(`${untilDate.value}T${untilTime.value || '00:00'}`)
    return Number.isNaN(t.getTime()) ? null : { kind: 'until', at: t }
  }
  return presetsFor(at).find(p => p.id === choiceId.value)?.choice(at) ?? null
}

const minutes = computed(() => choiceMinutes(choiceAt(now.value), now.value))
const endsAt = computed(() => addMinutes(now.value, minutes.value))

function addMinutes(d: Date, m: number) { return new Date(d.getTime() + m * 60_000) }
function fmtEnd(d: Date) {
  const sameYear = d.getFullYear() === now.value.getFullYear()
  return d.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Key ─────────────────────────────────────────────────────────────────────
const comboMode = ref<'text' | 'photo'>('text')
const photoPreview = ref<string | null>(null)
const uploading = ref(false)
const uploadError = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const form = reactive({
  combination_text: '',
  combination_photo_url: '',
  emotion: '',
  reason: '',
})

const combinationReady = computed(() =>
  comboMode.value === 'text' ? !!form.combination_text : !!form.combination_photo_url,
)

function triggerFileInput() { fileInputRef.value?.click() }

async function processFile(file: File) {
  if (!file.type.startsWith('image/')) {
    uploadError.value = 'Please select an image file.'
    return
  }
  photoPreview.value = URL.createObjectURL(file)
  form.combination_photo_url = ''
  uploadError.value = ''
  uploading.value = true
  try {
    form.combination_photo_url = await uploadCombinationPhoto(file)
  }
  catch (err: unknown) {
    uploadError.value = (err as Error).message
    photoPreview.value = null
  }
  finally { uploading.value = false }
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) processFile(file)
}

function onPhotoDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0]
  if (file) processFile(file)
}

// ── Start ───────────────────────────────────────────────────────────────────
const startMode = ref<StartMode>('invite')
const visitorPermission = ref<Perm>('add')
const visitorHours = ref(1)
const listed = ref(false)
const moreOpen = ref(false)
const customEmotion = ref('')

function toggleEmotion(emoji: string) {
  form.emotion = form.emotion === emoji ? '' : emoji
  customEmotion.value = ''
}

// ── Summary ─────────────────────────────────────────────────────────────────
const ringDash = computed(() => {
  // A month fills the ring, anything shorter shows a slice.
  const p = Math.min(1, minutes.value / LOCKTOBER_30_MINUTES)
  return (145 * Math.max(p, minutes.value ? 0.04 : 0)).toFixed(1)
})
const countsFor = computed(() => {
  if (!october.value || !minutes.value) return ''
  return minutes.value >= LOCKTOBER_30_MINUTES ? 'Locktober 30 🏆' : 'Locktober "Most time"'
})
const keyLine = computed(() => {
  if (step.value < 2) return 'Next step'
  if (comboMode.value === 'photo') return form.combination_photo_url ? 'Photo, hidden' : 'Photo'
  return form.combination_text ? 'Code, hidden' : 'Not set'
})
const holderLine = computed(() => ({ invite: 'Invited keyholder', keydrop: 'From Key Drop', self: 'You' })[startMode.value])
const visitorsLine = computed(() => {
  if (startMode.value !== 'self') return 'Keyholder decides'
  const p = visitorPermission.value
  if (p === 'none') return 'Can watch'
  return `${p === 'add' ? '+' : p === 'remove' ? '−' : '±'}${visitorHours.value}h per click`
})
const lockLabel = computed(() => {
  if (startMode.value === 'invite') return 'Lock and invite'
  if (startMode.value === 'keydrop') return 'Lock and drop the key'
  return minutes.value ? `Lock until ${endsAt.value.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}` : 'Lock it'
})
const footLine = computed(() => {
  const parts = [minutes.value ? formatMinutes(minutes.value) : '', comboMode.value === 'photo' ? 'photo hidden' : 'code hidden']
  if (startMode.value === 'self') parts.push(visitorsLine.value.toLowerCase())
  return parts.filter(Boolean).join(' · ')
})

// ── Flow ────────────────────────────────────────────────────────────────────
const step = ref(1)
const submitting = ref(false)
const submitError = ref('')
const showUpgradeCta = ref(false)
const errors = reactive({ combination: '' })

function nextStep() {
  if (step.value === 1 && !minutes.value) return
  if (step.value === 2) {
    if (!combinationReady.value) { errors.combination = 'Combination is required.'; return }
    errors.combination = ''
  }
  step.value++
  if (step.value === 2 && !form.combination_text) form.combination_text = randomCode()
  if (import.meta.client) window.scrollTo({ top: 0 })
}

function prevStep() { if (step.value > 1) step.value-- }

async function submit() {
  submitting.value = true
  submitError.value = ''
  try {
    // Recompute now: "until Monday 8:00" must end at 8:00, however long this took.
    const at = new Date()
    const duration = choiceMinutes(choiceAt(at), at)
    if (!duration) throw Object.assign(new Error('That end time has passed. Pick a new one.'), { statusCode: 400 })
    const self = startMode.value === 'self'
    const loq = await createLoq({
      duration_minutes: duration,
      combination_text: comboMode.value === 'text' ? form.combination_text || undefined : undefined,
      combination_photo_url: comboMode.value === 'photo' ? form.combination_photo_url || undefined : undefined,
      emotion: form.emotion || undefined,
      reason: form.reason || undefined,
      self,
      ...(self
        ? { visitor_permission: visitorPermission.value, visitor_add_hours: visitorHours.value, listed_in_discover: listed.value }
        : {}),
    })
    if (startMode.value === 'keydrop') {
      try { await publishLoq(loq.id) }
      catch { /* the lock exists; it can still be published from the dashboard */ }
      await router.push('/dashboard/wearer')
    }
    else if (startMode.value === 'invite') {
      await router.push(`/lock/${loq.id}/find-keyholder`)
    }
    else {
      await router.push('/dashboard/wearer')
    }
  }
  catch (err: unknown) {
    const e = err as { message: string; statusCode?: number }
    submitError.value = e.message
    showUpgradeCta.value = e.statusCode === 402
  }
  finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.create-page {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  background: var(--color-bg);
}

.create-glow {
  position: absolute;
  top: -160px;
  left: 50%;
  width: 900px;
  height: 600px;
  transform: translateX(-50%);
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(closest-side, rgba(var(--color-brand-rgb), 0.22), rgba(var(--color-brand-rgb), 0));
}

// ── Header + progress ────────────────────────────────────────────────────────

.create-nav {
  position: relative;
  max-width: 1000px;
  width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 24px 20px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  &__back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: -6px;
    padding: 8px 10px 8px 4px;
    border-radius: 999px;
    color: var(--color-text-muted);
    font-size: 15px;
    font-weight: 500;
    text-decoration: none;
    svg { width: 20px; height: 20px; }
    &:hover { color: var(--color-text); text-decoration: none; background: rgba(244, 240, 255, 0.06); }
  }

  &__back { border: 0; background: none; font-family: var(--font-sans); cursor: pointer; }
}

.steps {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-muted);

    & + li::before { content: ''; width: 18px; height: 2px; border-radius: 2px; background: var(--color-border); margin-right: 2px; }
  }

  i {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1.5px solid var(--color-border);
    font-style: normal;
    font-size: 12px;
  }

  .on { color: var(--color-text); i { border-color: transparent; background: var(--gradient-brand); color: var(--color-on-accent); } }
  .done i { border-color: var(--color-accent); color: var(--color-accent); }
}

.create-grid {
  position: relative;
  max-width: 1000px;
  width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 0 20px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 40px;
  align-items: start;
}

// ── Step shell ───────────────────────────────────────────────────────────────

.create-main {
  position: relative;
  min-width: 0;
  padding: 28px 0 64px;
}

.create-step {
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: step-in 0.35s cubic-bezier(0.16, 1, 0.3, 1);

  &__title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(36px, 7vw, 52px);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1;
  }

  &__hint {
    margin: -8px 0 4px;
    font-size: 17px;
    line-height: 1.55;
    color: #CFC5F2;
  }
}

@keyframes step-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .create-step { animation: none; }
}

.create-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;

  .btn { flex: 1; }
  .btn--ghost { flex: 0 0 auto; min-width: 110px; }
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  padding: 0 26px;
  border-radius: 999px;
  border: 0;
  font-family: var(--font-sans);
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.12s, filter 0.15s, border-color 0.15s;

  &:disabled { opacity: 0.45; cursor: not-allowed; }
  &:active:not(:disabled) { transform: scale(0.98); }

  &--primary {
    background: var(--color-cta);
    color: var(--color-on-accent);
    box-shadow: 0 10px 32px rgba(var(--color-cta-rgb), 0.3);
    &:hover:not(:disabled) { filter: brightness(1.06); }
  }

  &--lock {
    background: var(--gradient-brand);
    box-shadow: 0 12px 40px rgba(var(--color-brand-rgb), 0.4);
  }

  &--ghost {
    background: transparent;
    color: var(--color-text);
    border: 1.5px solid rgba(244, 240, 255, 0.3);
    font-weight: 600;
    &:hover:not(:disabled) { border-color: rgba(244, 240, 255, 0.6); }
  }
}

.create-error {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(var(--color-danger-rgb), 0.1);
  border: 1px solid rgba(var(--color-danger-rgb), 0.35);
  color: var(--color-danger);
  font-size: 14px;
}

.create-upgrade-cta {
  align-self: flex-start;
  color: var(--color-cta);
  font-weight: 700;
  text-decoration: none;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

// ── Step 1: duration ─────────────────────────────────────────────────────────

.duration-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.duration-chip {
  height: 56px;
  border-radius: 16px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;

  &:hover { border-color: var(--color-elevated); }
  &:active { transform: scale(0.97); }

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1.1;

  small { font-family: var(--font-sans); font-size: 11px; font-weight: 500; color: var(--color-text-muted); }

  &--active {
    border-color: transparent;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    font-weight: 700;
    small { color: inherit; opacity: 0.8; }
  }
}

.custom-block {
  position: relative;
  padding: 28px 16px 20px;
  border-radius: 24px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  transition: border-color 0.2s;

  &--active { border-color: rgba(var(--color-accent-rgb), 0.45); }

  &__tag {
    position: absolute;
    top: -10px;
    left: 18px;
    padding: 0 8px;
    background: var(--color-bg);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  &__spinners { display: flex; gap: 12px; }

  &__preview {
    margin: 0;
    font-size: 15px;
    color: #CFC5F2;
    strong { color: var(--color-text); font-family: var(--font-display); font-size: 17px; }
  }
}

.dur-spin {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 92px;
  padding: 6px 0 12px;
  border-radius: 18px;
  background: rgba(14, 0, 51, 0.55);
  border: 1px solid var(--color-border);

  &__arrow {
    width: 48px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 10px;
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &:hover:not(:disabled) { color: var(--color-text); background: rgba(var(--color-accent-rgb), 0.12); }
    &:disabled { opacity: 0.25; cursor: default; }
  }

  &__val {
    font-family: var(--font-display);
    font-size: 40px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    background: var(--gradient-brand);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  &__label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
}

// ── Step 2: combination ──────────────────────────────────────────────────────

.seg {
  display: inline-flex;
  align-self: flex-start;
  padding: 4px;
  border-radius: 999px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);

  &__btn {
    min-width: 100px;
    height: 42px;
    padding: 0 20px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--color-text-muted);
    font-family: var(--font-sans);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;

    &--on { background: var(--color-elevated); color: var(--color-text); }
  }
}

.create-input,
.create-textarea {
  width: 100%;
  box-sizing: border-box;
  border-radius: 16px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 17px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;

  &::placeholder { color: rgba(169, 156, 214, 0.55); }
  &:focus {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 4px rgba(var(--color-accent-rgb), 0.18);
  }
}

.create-input {
  height: 60px;
  padding: 0 20px;

  &--code {
    height: 84px;
    text-align: center;
    font-family: var(--font-display);
    font-size: 40px;
    font-weight: 700;
    letter-spacing: 0.3em;
  }
}

.create-textarea {
  padding: 16px 18px;
  line-height: 1.5;
  resize: vertical;
}

.create-input-meta {
  margin: -12px 0 0;
  text-align: right;
  font-size: 13px;
  color: var(--color-text-muted);

  &--ok { text-align: left; color: var(--color-accent); font-weight: 600; margin-top: 0; }
}

.photo-upload {
  position: relative;
  min-height: 220px;
  border-radius: 24px;
  border: 2px dashed var(--color-elevated);
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s;

  &:hover { border-color: var(--color-accent); }
  &--filled { border-style: solid; padding: 0; }

  &__icon { width: 44px; height: 44px; color: var(--color-accent); margin-bottom: 6px; }
  &__hint { margin: 0; font-size: 17px; font-weight: 600; color: var(--color-text); }
  &__sub { margin: 0; font-size: 14px; color: var(--color-text-muted); }
  &__preview { width: 100%; max-height: 360px; object-fit: contain; display: block; }
  &__input { display: none; }
}

// ── Step 3: mood ─────────────────────────────────────────────────────────────

.emotion-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.emotion-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 110px;
  border-radius: 20px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;

  &:hover { border-color: var(--color-elevated); }
  &:active { transform: scale(0.97); }

  &--active {
    border-color: var(--color-accent);
    background: linear-gradient(160deg, rgba(var(--color-brand-rgb), 0.2) 0%, var(--color-surface) 70%);
    box-shadow: 0 0 0 4px rgba(var(--color-accent-rgb), 0.15);
  }

  &__emoji { font-size: 38px; line-height: 1; }
  &__label { font-size: 13px; font-weight: 600; color: var(--color-text-muted); text-transform: capitalize; }

  &__input {
    width: 70%;
    height: 44px;
    border: 0;
    background: transparent;
    color: var(--color-text);
    text-align: center;
    font-size: 32px;
    outline: none;
    &::placeholder { color: var(--color-text-muted); font-size: 28px; }
  }
}


// ── New flow pieces ─────────────────────────────────────────────────────────

.lbl {
  margin: 4px 0 -8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.lt-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 20px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &__ico { font-size: 28px; }
  &__txt { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  b { font-family: var(--font-display); font-size: 20px; }
  small { font-size: 14px; color: var(--color-text-muted); line-height: 1.4; }
  &__chk {
    display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
    border: 1.5px solid var(--color-border); color: transparent; font-weight: 800;
  }

  &--on {
    border-color: var(--color-accent);
    background: linear-gradient(160deg, rgba(var(--color-brand-rgb), 0.22) 0%, var(--color-surface) 70%);
    box-shadow: 0 0 0 4px rgba(var(--color-accent-rgb), 0.15);
    .lt-card__chk { border-color: transparent; background: var(--gradient-brand); color: var(--color-on-accent); }
  }
}

.until {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 12px;
  label { display: flex; flex-direction: column; gap: 6px; }
  span { font-size: 12px; color: var(--color-text-muted); font-weight: 600; }
  .create-input { color-scheme: dark; }
}

.create-preview {
  margin: 0;
  font-size: 15px;
  color: #CFC5F2;
  strong { color: var(--color-text); font-family: var(--font-display); font-size: 18px; }
}

.create-input-meta--left { text-align: left; margin-top: -12px; }
.create-input-meta--center { text-align: center; margin: 0; }

.create-actions--col { flex-direction: column; .btn { width: 100%; } }

.code-row {
  display: flex;
  gap: 10px;
  .create-input--code { flex: 1; }
}

.gen {
  flex: 0 0 auto;
  padding: 0 18px;
  border-radius: 16px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font: 600 15px var(--font-sans);
  cursor: pointer;
  &:hover { border-color: var(--color-accent); }
}

.tip {
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(var(--color-cta-rgb), 0.08);
  border: 1px solid rgba(var(--color-cta-rgb), 0.25);
  font-size: 14px;
  line-height: 1.5;
  color: #FFD9C7;
  b { color: var(--color-cta); }
}

.start-list { display: flex; flex-direction: column; gap: 10px; }

.sc {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  i { font-style: normal; font-size: 26px; }
  span { display: flex; flex-direction: column; gap: 3px; }
  b { font-family: var(--font-display); font-size: 18px; }
  small { font-size: 14px; color: var(--color-text-muted); line-height: 1.4; }

  &:hover { border-color: var(--color-elevated); }
  &--on {
    border-color: var(--color-accent);
    background: linear-gradient(160deg, rgba(var(--color-brand-rgb), 0.18) 0%, var(--color-surface) 70%);
    box-shadow: 0 0 0 4px rgba(var(--color-accent-rgb), 0.15);
  }
}

.vis {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border-radius: 18px;
  background: rgba(14, 0, 51, 0.55);
  border: 1px solid var(--color-border);

  h4 { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: var(--color-text-muted); }
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  button {
    padding: 9px 14px;
    border-radius: 999px;
    border: 1.5px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    font: 600 14px var(--font-sans);
    cursor: pointer;
    &.on { border-color: transparent; background: var(--gradient-brand); color: var(--color-on-accent); }
  }
}

.tg {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 6px;
  font-size: 15px;
  cursor: pointer;
}

.sw {
  appearance: none;
  position: relative;
  flex: 0 0 auto;
  width: 46px;
  height: 26px;
  margin: 0;
  border-radius: 999px;
  background: var(--color-elevated);
  cursor: pointer;
  transition: background 0.15s;

  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--color-text);
    transition: transform 0.15s;
  }

  &:checked { background: var(--gradient-brand); &::after { transform: translateX(20px); } }
}

.more {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-radius: 16px;
  border: 1.5px dashed var(--color-border);
  background: none;
  color: var(--color-text);
  font: 600 15px var(--font-sans);
  cursor: pointer;
  &:hover { border-color: var(--color-accent); }
}

.more-body { display: flex; flex-direction: column; gap: 16px; }

.sum {
  position: sticky;
  top: 24px;
  margin-top: 28px;
  padding: 20px;
  border-radius: 22px;
  background: rgba(14, 0, 51, 0.55);
  border: 1px solid var(--color-border);

  h3 {
    margin: 0 0 14px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  &__ring {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-bottom: 14px;
    b { display: block; font-family: var(--font-display); font-size: 22px; }
    small { font-size: 13px; color: var(--color-text-muted); }
  }

  &__row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 11px 0;
    border-top: 1px solid var(--color-border);
    font-size: 14px;
    span { color: var(--color-text-muted); }
    b { text-align: right; font-weight: 600; }
    .todo { color: var(--color-text-muted); font-weight: 500; font-style: italic; }
  }
}

@media (max-width: 860px) {
  .create-grid { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .sum { display: none; }
  .steps span { display: none; }
  .steps .on span { display: inline; }
}

@media (max-width: 560px) {
  .duration-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dur-spin { width: 84px; }
  .create-main { padding-top: 20px; }
  .until { grid-template-columns: 1fr; }
}
</style>
