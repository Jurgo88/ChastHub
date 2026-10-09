<template>
  <!-- Visitor share link — the keyholder controls both the link and the amount -->
  <div class="vshare">
    <button
      v-if="!loq.public_link_id"
      type="button"
      class="vshare__generate"
      :disabled="pending"
      @click="handleGenerateLink"
    >Generate visitor link</button>

    <template v-else>
      <div class="visitor-link">
        <svg class="visitor-link__icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6.5 9.5L9.5 6.5M7 4H5a3 3 0 000 6h1m2-6h2a3 3 0 010 6h-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <code class="visitor-link__url">{{ linkUrl }}</code>
        <button type="button" class="visitor-link__copy" :class="{ 'visitor-link__copy--done': copied }" @click="copyLink">
          {{ copied ? 'Copied' : 'Copy' }}
        </button>
      </div>
      <p class="visitor-count">{{ loq.visitor_count ?? 0 }} visitor{{ (loq.visitor_count ?? 0) !== 1 ? 's' : '' }} interacted</p>

      <div class="visitor-amount">
        <p class="visitor-amount__caption">Each vote changes the timer by</p>
        <div class="visitor-amount__segmented">
          <button
            v-for="preset in VISITOR_PRESETS"
            :key="preset.hours"
            type="button"
            class="visitor-amount__seg"
            :class="{ 'visitor-amount__seg--active': !showCustom && loq.visitor_add_hours === preset.hours }"
            :disabled="pending"
            @click="selectPreset(preset.hours)"
          >{{ preset.label }}</button>
          <button
            type="button"
            class="visitor-amount__seg"
            :class="{ 'visitor-amount__seg--active': showCustom || isCustomAmount }"
            :disabled="pending"
            @click="toggleCustom"
          >Custom</button>
        </div>

        <div v-if="showCustom" class="visitor-stepper">
          <button type="button" class="visitor-stepper__btn" aria-label="Less" :disabled="pending || customAmount <= MIN_VISITOR_HOURS" @click="stepCustom(-1)">−</button>
          <div class="visitor-stepper__val">{{ formatHours(customAmount) }}</div>
          <button type="button" class="visitor-stepper__btn" aria-label="More" :disabled="pending || customAmount >= MAX_VISITOR_HOURS" @click="stepCustom(1)">+</button>
          <button
            type="button"
            class="visitor-stepper__confirm"
            :disabled="pending || customAmount === loq.visitor_add_hours"
            @click="handleSetVisitorAmount(customAmount)"
          >Set</button>
        </div>
      </div>

      <!-- TASK-089 -->
      <div class="visitor-amount">
        <p class="visitor-amount__caption">Visitors can</p>
        <div class="visitor-amount__segmented">
          <button
            v-for="perm in VISITOR_PERMISSIONS"
            :key="perm.value"
            type="button"
            class="visitor-amount__seg"
            :class="{ 'visitor-amount__seg--active': (loq.visitor_permission ?? 'both') === perm.value }"
            :disabled="pending"
            @click="handleSetVisitorPermission(perm.value)"
          >{{ perm.label }}</button>
        </div>
      </div>
    </template>

    <p v-if="error" class="vshare__err" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import type { Loq } from '~/types'

const props = defineProps<{ loq: Loq }>()
const emit = defineEmits<{ patch: [patch: Partial<Loq>] }>()

const { generateVisitorLink, setVisitorAmount, setVisitorPermission } = useLoqholder()

const VISITOR_PRESETS = [
  { label: '15m', hours: 0.25 },
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '1d', hours: 24 },
  { label: '3d', hours: 72 },
]

// TASK-089
const VISITOR_PERMISSIONS = [
  { label: 'Add only', value: 'add' as const },
  { label: 'Remove only', value: 'remove' as const },
  { label: 'Both', value: 'both' as const },
]

const MIN_VISITOR_HOURS = 1 / 60
// Keep in sync with server/utils/loqValidation.ts MAX_DURATION_MINUTES
// (TASK-085) — server files aren't importable from client components in Nuxt.
const MAX_VISITOR_HOURS = 3650 * 24

const pending = ref(false)
const error = ref('')
const copied = ref(false)
const showCustom = ref(false)
const customInput = ref<number | null>(null)

// A different lock in the same panel starts clean.
watch(() => props.loq.id, () => {
  showCustom.value = false
  customInput.value = null
  error.value = ''
})

const isCustomAmount = computed(() => !VISITOR_PRESETS.some(p => p.hours === props.loq.visitor_add_hours))
const customAmount = computed(() => customInput.value ?? props.loq.visitor_add_hours)

const linkUrl = computed(() => {
  if (!props.loq.public_link_id || !import.meta.client) return ''
  return `${window.location.origin}/lock/${props.loq.public_link_id}`
})

function toggleCustom() {
  showCustom.value = !showCustom.value
  if (showCustom.value && customInput.value === null) customInput.value = props.loq.visitor_add_hours
}

// Finer steps for short amounts, coarser once you're into multi-day territory
// — stepping from 15m to 7 days one hour at a time would be tedious.
function stepSizeFor(hours: number): number {
  if (hours < 1) return 0.25
  if (hours < 6) return 0.5
  if (hours < 24) return 1
  return 6
}

function stepCustom(dir: 1 | -1) {
  const current = customAmount.value
  const next = Math.round((current + dir * stepSizeFor(current)) * 100) / 100
  customInput.value = Math.min(MAX_VISITOR_HOURS, Math.max(MIN_VISITOR_HOURS, next))
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return hours % 1 === 0 ? `${hours}h` : `${Math.round(hours * 4) / 4}h`
  const days = hours / 24
  return days % 1 === 0 ? `${days}d` : `${Math.round(days * 10) / 10}d`
}

async function run(fn: () => Promise<void>) {
  pending.value = true
  error.value = ''
  try { await fn() }
  catch (err: unknown) { error.value = (err as Error).message }
  finally { pending.value = false }
}

const handleGenerateLink = () => run(async () => {
  const { public_link_id } = await generateVisitorLink(props.loq.id)
  emit('patch', { public_link_id })
})

async function selectPreset(hours: number) {
  showCustom.value = false
  await handleSetVisitorAmount(hours)
}

const handleSetVisitorAmount = (hours: number) => run(async () => {
  if (!hours || hours <= 0) return
  const { visitor_add_hours } = await setVisitorAmount(props.loq.id, hours)
  emit('patch', { visitor_add_hours })
  showCustom.value = false
})

const handleSetVisitorPermission = (permission: 'add' | 'remove' | 'both') => run(async () => {
  const { visitor_permission } = await setVisitorPermission(props.loq.id, permission)
  emit('patch', { visitor_permission: visitor_permission as 'add' | 'remove' | 'both' })
})

async function copyLink() {
  if (!linkUrl.value) return
  await navigator.clipboard.writeText(linkUrl.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/lock-dashboard' as *;

.vshare {
  @include field-group('Share visitor link');
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 8px;

  &__generate { @include dash-btn; min-height: 44px; }
  &__err { margin: 0; font-size: 13px; color: var(--color-danger); }
}

// ── Link chip: icon + truncated url + copy ───────────────────────────────────

.visitor-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem 0.5rem 0.75rem;
  border-radius: 0.625rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);

  &__icon { flex-shrink: 0; color: var(--color-accent); }

  &__url {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__copy {
    flex-shrink: 0;
    min-height: 2.25rem;
    padding: 0 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-muted);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;

    &:hover { border-color: var(--color-accent); color: var(--color-accent); }

    &--done {
      border-color: rgba(34, 197, 94, 0.4);
      color: #22c55e;
      background: rgba(34, 197, 94, 0.08);
    }
  }
}

.visitor-count { margin: 0; font-size: 0.75rem; color: var(--color-muted); }

// ── Visitor amount: segmented control + custom stepper ───────────────────────

.visitor-amount {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &__caption { font-size: 0.75rem; color: var(--color-muted); margin: 0; }

  &__segmented {
    display: flex;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.625rem;
    padding: 0.1875rem;
    gap: 0.1875rem;
  }

  &__seg {
    flex: 1;
    min-height: 2.25rem;
    border-radius: 0.4375rem;
    border: none;
    background: none;
    color: var(--color-muted);
    font-size: 0.75rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

    &:hover:not(:disabled):not(&--active) { color: var(--color-text); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }

    &--active {
      background: var(--color-accent);
      color: var(--color-on-accent);
      box-shadow: 0 1px 4px rgba(var(--color-accent-rgb), 0.45);
    }
  }
}

.visitor-stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.625rem;
  border-radius: 0.625rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);

  &__btn {
    flex-shrink: 0;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 1.125rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
    &:disabled { opacity: 0.35; cursor: not-allowed; }
  }

  &__val {
    min-width: 3.5rem;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-accent);
  }

  &__confirm {
    flex-shrink: 0;
    margin-left: 0.25rem;
    min-height: 2.25rem;
    padding: 0 0.875rem;
    border-radius: 0.5rem;
    border: 1px solid var(--color-accent);
    background: rgba(var(--color-accent-rgb), 0.1);
    color: var(--color-accent);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;

    &:hover:not(:disabled) { background: var(--color-accent); color: var(--color-on-accent); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }
}
</style>
