<template>
  <div class="create-page">
    <div class="create-glow" aria-hidden="true" />

    <header class="create-nav">
      <NuxtLink to="/dashboard/wearer" class="create-nav__back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        Dashboard
      </NuxtLink>
      <span class="create-nav__step">Step {{ step }} of {{ TOTAL_STEPS }} · {{ STEP_NAMES[step - 1] }}</span>
    </header>

    <div class="create-progress" aria-hidden="true">
      <span
        v-for="i in TOTAL_STEPS"
        :key="i"
        class="create-progress__bar"
        :class="{ 'create-progress__bar--on': step >= i }"
      />
    </div>

    <main class="create-main">

      <!-- Step 1: Duration -->
      <section v-if="step === 1" class="create-step">
        <h1 class="create-step__title">How long?</h1>
        <p class="create-step__hint">Pick a duration. The clock starts the moment you create the lock.</p>
        <div class="duration-grid">
          <button
            v-for="opt in DURATION_OPTIONS"
            :key="opt.value"
            class="duration-chip"
            :class="{ 'duration-chip--active': form.duration_minutes === opt.value }"
            type="button"
            @click="selectDuration(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
        <div class="custom-block" :class="{ 'custom-block--active': form.duration_minutes > 0 }">
          <span class="custom-block__tag">Or set your own</span>
          <div class="custom-block__spinners">

            <div class="dur-spin">
              <button class="dur-spin__arrow" type="button" aria-label="More days" :disabled="customDays >= MAX_CUSTOM_DAYS" @click="spinDay(1)">
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M2 9l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <span class="dur-spin__val">{{ String(customDays).padStart(2, '0') }}</span>
              <button class="dur-spin__arrow" type="button" aria-label="Fewer days" :disabled="customDays <= 0" @click="spinDay(-1)">
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M2 5l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <span class="dur-spin__label">Days</span>
            </div>

            <div class="dur-spin">
              <button class="dur-spin__arrow" type="button" aria-label="More hours" :disabled="customHours >= 23" @click="spinHour(1)">
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M2 9l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <span class="dur-spin__val">{{ String(customHours).padStart(2, '0') }}</span>
              <button class="dur-spin__arrow" type="button" aria-label="Fewer hours" :disabled="customHours <= 0" @click="spinHour(-1)">
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M2 5l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <span class="dur-spin__label">Hours</span>
            </div>

            <div class="dur-spin">
              <button class="dur-spin__arrow" type="button" aria-label="More minutes" :disabled="customMinutes >= 59" @click="spinMinute(1)">
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M2 9l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <span class="dur-spin__val">{{ String(customMinutes).padStart(2, '0') }}</span>
              <button class="dur-spin__arrow" type="button" aria-label="Fewer minutes" :disabled="customMinutes <= 0" @click="spinMinute(-1)">
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M2 5l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <span class="dur-spin__label">Min</span>
            </div>

          </div>
          <p v-if="form.duration_minutes > 0" class="custom-block__preview">
            You'll be locked for <strong>{{ formatDuration(form.duration_minutes) }}</strong>
          </p>
        </div>
        <p v-if="errors.duration" class="create-error">{{ errors.duration }}</p>
        <div class="create-actions">
          <button class="btn btn--primary" :disabled="!form.duration_minutes" @click="nextStep">Continue</button>
        </div>
      </section>

      <!-- Step 2: Combination -->
      <section v-if="step === 2" class="create-step">
        <h1 class="create-step__title">Hide your combination</h1>
        <p class="create-step__hint">
          Enter your padlock code or add a photo of it. It stays hidden from you until the lock ends.
        </p>

        <div class="seg" role="tablist" aria-label="Combination type">
          <button
            class="seg__btn"
            :class="{ 'seg__btn--on': comboMode === 'text' }"
            type="button"
            role="tab"
            :aria-selected="comboMode === 'text'"
            @click="comboMode = 'text'"
          >Code</button>
          <button
            class="seg__btn"
            :class="{ 'seg__btn--on': comboMode === 'photo' }"
            type="button"
            role="tab"
            :aria-selected="comboMode === 'photo'"
            @click="comboMode = 'photo'"
          >Photo</button>
        </div>

        <template v-if="comboMode === 'text'">
          <label class="sr-only" for="combo-text">Combination</label>
          <input
            id="combo-text"
            v-model.trim="form.combination_text"
            type="text"
            class="create-input create-input--code"
            maxlength="10"
            placeholder="1234"
            autocomplete="off"
            autofocus
          />
          <p class="create-input-meta">{{ form.combination_text.length }}/10</p>
        </template>

        <template v-else>
          <div class="photo-upload" :class="{ 'photo-upload--filled': !!photoPreview }" @click="triggerFileInput" @dragover.prevent @drop.prevent="onPhotoDrop">
            <img v-if="photoPreview" :src="photoPreview" class="photo-upload__preview" alt="Combination preview" />
            <template v-else>
              <svg class="photo-upload__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              <p class="photo-upload__hint">Tap to take or choose a photo</p>
              <p class="photo-upload__sub">or drag it here</p>
            </template>
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              class="photo-upload__input"
              @change="onFileChange"
            />
          </div>
          <p v-if="uploadError" class="create-error">{{ uploadError }}</p>
          <p v-if="uploading" class="create-input-meta">Uploading…</p>
          <p v-else-if="form.combination_photo_url" class="create-input-meta create-input-meta--ok">Photo ready</p>
        </template>

        <p v-if="errors.combination" class="create-error">{{ errors.combination }}</p>
        <div class="create-actions">
          <button class="btn btn--ghost" @click="prevStep">Back</button>
          <button
            class="btn btn--primary"
            :disabled="!combinationReady || uploading"
            @click="nextStep"
          >
            Continue
          </button>
        </div>
      </section>

      <!-- Step 3: Emotion -->
      <section v-if="step === 3" class="create-step">
        <h1 class="create-step__title">How are you feeling?</h1>
        <p class="create-step__hint">Your keyholder and visitors will see it. You can change it any time.</p>
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
          <!-- TASK-070: type/paste a custom emoji instead of only presets -->
          <label class="emotion-btn emotion-btn--custom" :class="{ 'emotion-btn--active': !!customEmotion && form.emotion === customEmotion }">
            <input
              v-model="customEmotion"
              class="emotion-btn__input"
              type="text"
              maxlength="8"
              placeholder="＋"
              aria-label="Custom emoji"
              @input="form.emotion = customEmotion.trim()"
            />
            <span class="emotion-btn__label">your own</span>
          </label>
        </div>
        <div class="create-actions">
          <button class="btn btn--ghost" @click="prevStep">Back</button>
          <button class="btn btn--primary" @click="nextStep">{{ form.emotion ? 'Continue' : 'Skip' }}</button>
        </div>
      </section>

      <!-- Step 4: Note + start -->
      <section v-if="step === 4" class="create-step">
        <h1 class="create-step__title">Almost locked</h1>
        <p class="create-step__hint">Add a note for your keyholder, then choose how to start.</p>

        <label class="sr-only" for="lock-note">Note</label>
        <textarea
          id="lock-note"
          v-model.trim="form.reason"
          class="create-textarea"
          maxlength="100"
          rows="3"
          placeholder="First Locktober. Be gentle… or don't."
        />
        <p class="create-input-meta">{{ form.reason.length }}/100</p>

        <div class="start-cards" role="radiogroup" aria-label="How do you want to start?">
          <button
            type="button"
            role="radio"
            class="start-card"
            :class="{ 'start-card--on': startMode === 'paired' }"
            :aria-checked="startMode === 'paired'"
            @click="startMode = 'paired'"
          >
            <svg class="start-card__icon" viewBox="0 0 24 24" fill="none" stroke="#FB773C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="4.5" /><path d="M11.2 11.2 20 20" /><path d="m16 16 2-2" /><path d="m18.5 18.5 2-2" /></svg>
            <span class="start-card__title">Find a keyholder</span>
            <span class="start-card__text">Ask someone you trust, or drop your key in Key Drop.</span>
          </button>
          <button
            type="button"
            role="radio"
            class="start-card"
            :class="{ 'start-card--on': startMode === 'self' }"
            :aria-checked="startMode === 'self'"
            @click="startMode = 'self'"
          >
            <svg class="start-card__icon" viewBox="0 0 24 24" fill="none" stroke="#F25A93" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /><circle cx="12" cy="16" r="1.4" /></svg>
            <span class="start-card__title">Lock myself</span>
            <span class="start-card__text">You hold the timer. Share your link so others can add time.</span>
          </button>
        </div>

        <div class="create-summary">
          <div class="summary-row">
            <span class="summary-label">Duration</span>
            <span class="summary-value">{{ formatDuration(form.duration_minutes) }}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Combination</span>
            <span class="summary-value summary-value--secret">{{ form.combination_photo_url ? 'Photo, hidden' : '•••• hidden' }}</span>
          </div>
          <div v-if="form.emotion" class="summary-row">
            <span class="summary-label">Mood</span>
            <span class="summary-value">{{ form.emotion }}</span>
          </div>
        </div>

        <p v-if="submitError" class="create-error">{{ submitError }}</p>
        <NuxtLink v-if="showUpgradeCta" to="/subscription/upgrade" class="create-upgrade-cta">
          See plans →
        </NuxtLink>
        <div class="create-actions">
          <button class="btn btn--ghost" @click="prevStep">Back</button>
          <button class="btn btn--primary btn--lock" :disabled="submitting" @click="submit">
            {{ submitting ? 'Locking…' : 'Lock it' }}
          </button>
        </div>
      </section>

    </main>
  </div>
</template>

<script setup lang="ts">
import { uploadCombinationPhoto } from '~/composables/useLoq'

definePageMeta({ middleware: ['auth', 'subscription'] })

const router = useRouter()
const { createLoq } = useLoq()

const TOTAL_STEPS = 4
const STEP_NAMES = ['Duration', 'Combination', 'Mood', 'Start']

// Keep in sync with server/utils/loqValidation.ts MAX_DURATION_MINUTES
// (TASK-085) — server files aren't importable from client pages in Nuxt.
const MAX_CUSTOM_DAYS = 3650
const MAX_CUSTOM_MINUTES = MAX_CUSTOM_DAYS * 1440

const DURATION_OPTIONS = [
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '8 hours', value: 480 },
  { label: '12 hours', value: 720 },
  { label: '24 hours', value: 1440 },
  { label: '48 hours', value: 2880 },
  { label: '72 hours', value: 4320 },
]

const EMOTIONS = [
  { label: 'excited', emoji: '🤭' },
  { label: 'chill', emoji: '😅' },
  { label: 'weak', emoji: '😵' },
  { label: 'nervous', emoji: '🥺' },
  { label: 'hopeless', emoji: '😭' },
] as const

const step = ref(1)
const customDays = ref(0)
const customHours = ref(0)
const customMinutes = ref(0)
const submitting = ref(false)
const submitError = ref('')
const showUpgradeCta = ref(false)
const errors = reactive({ duration: '', combination: '' })

const comboMode = ref<'text' | 'photo'>('text')
const startMode = ref<'paired' | 'self'>('paired')
const customEmotion = ref('')
const photoPreview = ref<string | null>(null)
const uploading = ref(false)
const uploadError = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const form = reactive({
  duration_minutes: 0,
  combination_text: '',
  combination_photo_url: '',
  emotion: '',
  reason: '',
})

const combinationReady = computed(() =>
  comboMode.value === 'text' ? !!form.combination_text : !!form.combination_photo_url,
)

function selectDuration(minutes: number) {
  form.duration_minutes = minutes
  customDays.value = Math.floor(minutes / 1440)
  customHours.value = Math.floor((minutes % 1440) / 60)
  customMinutes.value = minutes % 60
}

function onCustomDuration() {
  const total = customDays.value * 1440 + customHours.value * 60 + customMinutes.value
  form.duration_minutes = total >= 1 && total <= MAX_CUSTOM_MINUTES ? total : 0
}

function spinDay(delta: number) {
  customDays.value = Math.max(0, Math.min(MAX_CUSTOM_DAYS, customDays.value + delta))
  onCustomDuration()
}

function spinHour(delta: number) {
  customHours.value = Math.max(0, Math.min(23, customHours.value + delta))
  onCustomDuration()
}

function spinMinute(delta: number) {
  customMinutes.value = Math.max(0, Math.min(59, customMinutes.value + delta))
  onCustomDuration()
}

function toggleEmotion(emoji: string) {
  form.emotion = form.emotion === emoji ? '' : emoji
  customEmotion.value = ''
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}


function triggerFileInput() {
  fileInputRef.value?.click()
}

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

function nextStep() {
  if (step.value === 1) {
    if (!form.duration_minutes) { errors.duration = 'Please select a duration.'; return }
    errors.duration = ''
  }
  if (step.value === 2) {
    if (!combinationReady.value) { errors.combination = 'Combination is required.'; return }
    errors.combination = ''
  }
  step.value++
}

function prevStep() {
  step.value--
}

async function submit() {
  submitting.value = true
  submitError.value = ''
  try {
    await createLoq({
      duration_minutes: form.duration_minutes,
      combination_text: form.combination_text || undefined,
      combination_photo_url: form.combination_photo_url || undefined,
      emotion: form.emotion || undefined,
      reason: form.reason || undefined,
      self: startMode.value === 'self',
    })
    await router.push('/dashboard/wearer')
  }
  catch (err: unknown) {
    const e = err as import('~/composables/useLoq').LoqApiError
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
  max-width: 640px;
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

  &__step { font-size: 14px; color: var(--color-text-muted); font-weight: 500; }
}

.create-progress {
  position: relative;
  max-width: 640px;
  width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  gap: 6px;

  &__bar {
    flex: 1;
    height: 4px;
    border-radius: 999px;
    background: var(--color-elevated);
    transition: background 0.3s;
    &--on { background: var(--gradient-brand); }
  }
}

// ── Step shell ───────────────────────────────────────────────────────────────

.create-main {
  position: relative;
  flex: 1;
  max-width: 640px;
  width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 36px 20px 64px;
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

  &--active {
    border-color: transparent;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    font-weight: 700;
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

// ── Step 4: start + summary ─────────────────────────────────────────────────

.start-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.start-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 20px;
  border-radius: 20px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover { border-color: var(--color-elevated); }

  &--on {
    border-color: var(--color-accent);
    background: linear-gradient(160deg, rgba(var(--color-brand-rgb), 0.18) 0%, var(--color-surface) 70%);
    box-shadow: 0 0 0 4px rgba(var(--color-accent-rgb), 0.15);
  }

  &__icon { width: 32px; height: 32px; }
  &__title { font-family: var(--font-display); font-size: 20px; font-weight: 700; }
  &__text { font-size: 14px; line-height: 1.45; color: var(--color-text-muted); }
}

.create-summary {
  padding: 8px 20px;
  border-radius: 20px;
  background: rgba(14, 0, 51, 0.55);
  border: 1px solid var(--color-border);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  & + & { border-top: 1px solid var(--color-border); }
}
.summary-label { font-size: 14px; color: var(--color-text-muted); }
.summary-value {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  &--secret { color: var(--color-accent); }
}

@media (max-width: 560px) {
  .duration-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .start-cards { grid-template-columns: minmax(0, 1fr); }
  .dur-spin { width: 84px; }
  .create-main { padding-top: 28px; }
}
</style>
