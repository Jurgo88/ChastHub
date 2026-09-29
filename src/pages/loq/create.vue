<template>
  <div class="create-page">

    <header class="create-nav">
      <NuxtLink to="/dashboard/loqee" class="create-nav__back">← Back</NuxtLink>
      <div class="step-dots">
        <span
          v-for="i in TOTAL_STEPS"
          :key="i"
          class="step-dot"
          :class="{ 'step-dot--active': step === i, 'step-dot--done': step > i }"
        />
      </div>
      <span class="create-nav__step">{{ step }}/{{ TOTAL_STEPS }}</span>
    </header>

    <main class="create-main">

      <!-- Step 1: Duration -->
      <section v-if="step === 1" class="create-step">
        <h1 class="create-step__title">How long?</h1>
        <p class="create-step__hint">Choose how long you want to be locked.</p>
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
          <span class="custom-block__tag">Custom</span>
          <div class="custom-block__spinners">

            <div class="dur-spin">
              <button class="dur-spin__arrow" type="button" :disabled="customDays >= MAX_CUSTOM_DAYS" @click="spinDay(1)">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 9l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <span class="dur-spin__val">{{ String(customDays).padStart(2, '0') }}</span>
              <button class="dur-spin__arrow" type="button" :disabled="customDays <= 0" @click="spinDay(-1)">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <span class="dur-spin__label">Days</span>
            </div>

            <span class="custom-block__sep">:</span>

            <div class="dur-spin">
              <button class="dur-spin__arrow" type="button" :disabled="customHours >= 23" @click="spinHour(1)">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 9l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <span class="dur-spin__val">{{ String(customHours).padStart(2, '0') }}</span>
              <button class="dur-spin__arrow" type="button" :disabled="customHours <= 0" @click="spinHour(-1)">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <span class="dur-spin__label">Hours</span>
            </div>

            <span class="custom-block__sep">:</span>

            <div class="dur-spin">
              <button class="dur-spin__arrow" type="button" :disabled="customMinutes >= 59" @click="spinMinute(1)">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 9l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <span class="dur-spin__val">{{ String(customMinutes).padStart(2, '0') }}</span>
              <button class="dur-spin__arrow" type="button" :disabled="customMinutes <= 0" @click="spinMinute(-1)">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <span class="dur-spin__label">Min</span>
            </div>

          </div>
          <div class="custom-block__footer">
            <span v-if="form.duration_minutes > 0" class="custom-block__preview">
              {{ formatDuration(form.duration_minutes) }}
            </span>
          </div>
        </div>
        <p v-if="errors.duration" class="create-error">{{ errors.duration }}</p>
        <div class="create-actions">
          <button class="btn btn--primary" :disabled="!form.duration_minutes" @click="nextStep">
            Next →
          </button>
        </div>
      </section>

      <!-- Step 2: Combination -->
      <section v-if="step === 2" class="create-step">
        <h1 class="create-step__title">Set a combination</h1>
        <p class="create-step__hint">
          Your keyholder will reveal this to unlock you. Enter your padlock combination.
        </p>

        <div class="combo-toggle">
          <button
            class="combo-toggle__btn"
            :class="{ 'combo-toggle__btn--active': comboMode === 'text' }"
            type="button"
            @click="comboMode = 'text'"
          >Text</button>
          <button
            class="combo-toggle__btn"
            :class="{ 'combo-toggle__btn--active': comboMode === 'photo' }"
            type="button"
            @click="comboMode = 'photo'"
          >Photo</button>
        </div>

        <template v-if="comboMode === 'text'">
          <input
            v-model.trim="form.combination_text"
            type="text"
            class="create-input"
            maxlength="10"
            placeholder="e.g. 1234"
            autofocus
          />
          <p class="create-input-meta">{{ form.combination_text.length }}/10</p>
        </template>

        <template v-else>
          <div class="photo-upload" @click="triggerFileInput" @dragover.prevent @drop.prevent="onPhotoDrop">
            <img v-if="photoPreview" :src="photoPreview" class="photo-upload__preview" alt="Combination preview" />
            <template v-else>
              <span class="photo-upload__icon">📷</span>
              <p class="photo-upload__hint">Click or drag a photo here</p>
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
          <p v-else-if="form.combination_photo_url" class="create-input-meta create-input-meta--ok">✓ Photo ready</p>
        </template>

        <p v-if="errors.combination" class="create-error">{{ errors.combination }}</p>
        <div class="create-actions">
          <button class="btn btn--ghost" @click="prevStep">← Back</button>
          <button
            class="btn btn--primary"
            :disabled="!combinationReady || uploading"
            @click="nextStep"
          >
            Next →
          </button>
        </div>
      </section>

      <!-- Step 3: Emotion -->
      <section v-if="step === 3" class="create-step">
        <h1 class="create-step__title">How are you feeling?</h1>
        <p class="create-step__hint">Pick your current mood.</p>
        <div class="emotion-grid">
          <button
            v-for="e in EMOTIONS"
            :key="e.emoji"
            class="emotion-btn"
            :class="{ 'emotion-btn--active': form.emotion === e.emoji }"
            type="button"
            :title="e.label"
            @click="toggleEmotion(e.emoji)"
          >
            {{ e.emoji }}
          </button>
          <!-- TASK-070: type/paste a custom emoji instead of only presets -->
          <input
            v-model="customEmotion"
            class="emotion-btn emotion-btn--custom"
            :class="{ 'emotion-btn--active': !!customEmotion && form.emotion === customEmotion }"
            type="text"
            maxlength="8"
            placeholder="＋"
            title="Custom emoji"
            @input="form.emotion = customEmotion.trim()"
          />
        </div>
        <div class="create-actions">
          <button class="btn btn--ghost" @click="prevStep">← Back</button>
          <button class="btn btn--primary" @click="nextStep">Next →</button>
        </div>
      </section>

      <!-- Step 4: Note -->
      <section v-if="step === 4" class="create-step">
        <h1 class="create-step__title">Why are you doing this?</h1>
        <p class="create-step__hint">Add a personal note.</p>
        <textarea
          v-model.trim="form.reason"
          class="create-textarea"
          maxlength="100"
          rows="4"
          placeholder="Hi, this is my lock..."
        />
        <p class="create-input-meta">{{ form.reason.length }}/100</p>

        <div class="create-summary">
          <h2 class="create-summary__title">Summary</h2>
          <div class="summary-row">
            <span class="summary-label">Duration</span>
            <span class="summary-value">{{ formatDuration(form.duration_minutes) }}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Combination</span>
            <span class="summary-value summary-value--secret">
              {{ form.combination_photo_url ? '📷 Photo set' : '••••••' }}
            </span>
          </div>
          <div v-if="form.emotion" class="summary-row">
            <span class="summary-label">Emotion</span>
            <span class="summary-value">{{ form.emotion }}</span>
          </div>
        </div>

        <div class="start-mode">
          <p class="start-mode__label">How do you want to start?</p>
          <div class="combo-toggle">
            <button
              class="combo-toggle__btn"
              :class="{ 'combo-toggle__btn--active': startMode === 'paired' }"
              type="button"
              @click="startMode = 'paired'"
            >Find a keyholder</button>
            <button
              class="combo-toggle__btn"
              :class="{ 'combo-toggle__btn--active': startMode === 'self' }"
              type="button"
              @click="startMode = 'self'"
            >Lock myself</button>
          </div>
          <p class="create-queue-hint">
            <template v-if="startMode === 'self'">
              No keyholder — your clock starts the moment you create this, and you're in control: pause or end it yourself any time. Share your visitor link so others can add time.
            </template>
            <template v-else>
              After creating, show your lock in
              <NuxtLink to="/discover" class="create-queue-hint__link">Discover</NuxtLink>
              so everyone can engage with your session.
            </template>
          </p>
        </div>
        <p v-if="submitError" class="create-error">{{ submitError }}</p>
        <NuxtLink v-if="showUpgradeCta" to="/subscription/upgrade" class="create-upgrade-cta">
          Upgrade your subscription →
        </NuxtLink>
        <div class="create-actions">
          <button class="btn btn--ghost" @click="prevStep">← Back</button>
          <button class="btn btn--primary" :disabled="submitting" @click="submit">
            {{ submitting ? 'Creating…' : 'Create Lock 🔒' }}
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
    await router.push('/dashboard/loqee')
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
@use '~/assets/styles/shared-ui' as *;

.create-page {
  /* TASK-153 — see .dash in _loq-card.scss: the default layout owns the
     viewport height now, so claiming it here too pushed the footer a full
     screen below the content. */
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

// ── Nav ────────────────────────────────────────────────────────────────────

.create-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  height: 3.25rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  flex-shrink: 0;

  &__back {
    font-size: 0.875rem;
    color: var(--color-muted);
    text-decoration: none;
    &:hover { color: var(--color-text); }
  }

  &__step {
    font-size: 0.8125rem;
    color: var(--color-muted);
  }
}

.step-dots {
  display: flex;
  gap: 0.5rem;
}

.step-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--color-border);
  transition: background 0.2s;

  &--active {
    background: var(--color-accent);
    transform: scale(1.2);
  }

  &--done {
    background: var(--color-accent);
    opacity: 0.4;
  }
}

// ── Step content ───────────────────────────────────────────────────────────

.create-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.create-step {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  &__title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
  }

  &__hint {
    font-size: 0.9375rem;
    color: var(--color-muted);
    margin: 0;
  }
}

// ── Combo toggle ───────────────────────────────────────────────────────────

.combo-toggle {
  display: flex;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  width: fit-content;

  &__btn {
    padding: 0.4rem 1.125rem;
    font-size: 0.875rem;
    font-weight: 500;
    background: none;
    border: none;
    color: var(--color-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;

    & + & { border-left: 1.5px solid var(--color-border); }

    &--active {
      background: var(--color-accent);
      color: var(--color-on-accent);
    }
  }
}

// ── Photo upload ────────────────────────────────────────────────────────────

.photo-upload {
  width: 100%;
  min-height: 9rem;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: border-color 0.15s;
  position: relative;
  overflow: hidden;
  background: var(--color-surface);

  &:hover { border-color: var(--color-accent); }

  &__icon { font-size: 2rem; }

  &__hint { font-size: 0.875rem; color: var(--color-muted); margin: 0; }

  &__preview {
    width: 100%;
    height: 100%;
    max-height: 14rem;
    object-fit: contain;
  }

  &__input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    font-size: 0;
  }
}

.create-input-meta--ok {
  color: #16a34a;
}

// ── Duration ───────────────────────────────────────────────────────────────

.duration-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.625rem;

  @media (max-width: 400px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.duration-chip {
  padding: 0.625rem 0.5rem;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: center;

  &:hover {
    border-color: var(--color-accent);
  }

  &--active {
    border-color: var(--color-accent);
    background: rgba(var(--color-accent-rgb), 0.08);
    color: var(--color-accent);
    font-weight: 600;
  }
}

.custom-block {
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 1.25rem 1rem 0.875rem;
  background: var(--color-surface);
  transition: border-color 0.2s, box-shadow 0.2s;
  position: relative;

  &--active {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px rgba(var(--color-accent-rgb), 0.1);
  }

  &__tag {
    position: absolute;
    top: -0.55rem;
    left: 1rem;
    background: var(--color-bg);
    padding: 0 0.375rem;
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--color-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__spinners {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 0.5rem;
  }

  &__sep {
    font-size: 2rem;
    font-weight: 300;
    color: var(--color-border);
    line-height: 1;
    margin-top: 2rem;
    user-select: none;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    min-height: 1.375rem;
    margin-top: 0.625rem;
  }

  &__preview {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-accent);
    letter-spacing: 0.02em;
  }
}

.dur-spin {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;

  &__arrow {
    width: 3rem;
    height: 2.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-muted);
    border-radius: var(--radius-sm);
    transition: color 0.12s, background 0.12s;
    -webkit-tap-highlight-color: transparent;

    &:hover:not(:disabled) {
      color: var(--color-accent);
      background: rgba(var(--color-accent-rgb), 0.07);
    }

    &:active:not(:disabled) {
      background: rgba(var(--color-accent-rgb), 0.14);
    }

    &:disabled {
      opacity: 0.25;
      cursor: default;
    }

    svg { display: block; }
  }

  &__val {
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.875rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
    line-height: 1;
  }

  &__label {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-top: 0.25rem;
  }
}

// ── Inputs ─────────────────────────────────────────────────────────────────

.create-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  background: var(--color-surface);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;

  &:focus { border-color: var(--color-accent); }
  &--inline { width: auto; flex: 1; }

  &::placeholder { color: var(--color-muted); }
}

.create-textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  background: var(--color-surface);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
  resize: vertical;
  min-height: 6rem;
  font-family: inherit;

  &:focus { border-color: var(--color-accent); }
  &::placeholder { color: var(--color-muted); }
}

.create-input-meta {
  font-size: 0.8rem;
  color: var(--color-muted);
  margin: -0.75rem 0 0;
  text-align: right;
}

// ── Emotion ────────────────────────────────────────────────────────────────

.emotion-grid {
  display: flex;
  gap: 0.875rem;
}

.emotion-btn {
  font-size: 2.25rem;
  background: none;
  border: 2.5px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 0.375rem;
  line-height: 1;
  transition: border-color 0.15s, transform 0.1s;

  &:hover { transform: scale(1.15); }

  &--active {
    border-color: var(--color-accent);
    background: rgba(var(--color-accent-rgb), 0.08);
  }

  &--custom {
    width: 3rem;
    text-align: center;
    color: var(--color-text);
    font-size: 1.5rem;

    &::placeholder { color: var(--color-muted); font-size: 1.25rem; }
    &:hover { transform: none; border-color: var(--color-border); }
    &:focus { outline: none; border-color: var(--color-accent); transform: none; }
  }
}

// ── Summary ────────────────────────────────────────────────────────────────

.create-summary {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;

  &__title {
    font-size: 0.8125rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-muted);
    margin: 0;
    font-weight: 600;
  }
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-label {
  font-size: 0.875rem;
  color: var(--color-muted);
}

.summary-value {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);

  &--secret {
    letter-spacing: 0.1em;
    color: var(--color-muted);
  }
}

// ── Actions ────────────────────────────────────────────────────────────────

.create-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.create-error {
  font-size: 0.875rem;
  color: #dc2626;
  margin: 0;
}

.start-mode {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;

  &__label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }
}

.create-queue-hint {
  font-size: 0.875rem;
  color: var(--color-muted);
  margin: 0;

  &__link {
    color: var(--color-accent);
    text-decoration: none;
    font-weight: 500;
    &:hover { text-decoration: underline; }
  }
}

.create-upgrade-cta {
  display: inline-block;
  font-size: 0.875rem;
  color: var(--color-accent);
  text-decoration: none;
  font-weight: 500;
  &:hover { text-decoration: underline; }
}

</style>
