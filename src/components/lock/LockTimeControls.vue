<template>
  <div class="ltc">
    <div class="ltc__quick" role="group" aria-label="Change the timer">
      <button
        v-for="q in QUICK"
        :key="q.minutes"
        type="button"
        class="ltc__q"
        :class="q.minutes < 0 ? 'ltc__q--remove' : 'ltc__q--add'"
        :disabled="disabled"
        :aria-label="`${q.minutes < 0 ? 'Remove' : 'Add'} ${spanMinutes(Math.abs(q.minutes))}`"
        @click="apply(q.minutes)"
      >{{ q.label }}</button>
      <button
        type="button"
        class="ltc__q ltc__q--custom"
        :aria-expanded="customOpen"
        aria-controls="ltc-custom"
        :disabled="disabled"
        @click="customOpen = !customOpen"
      >Custom</button>
    </div>

    <div v-if="customOpen" id="ltc-custom" class="ltc__custom">
      <div class="ltc__spinners">
        <div v-for="f in FIELDS" :key="f.key" class="ltc__spin">
          <button type="button" class="ltc__arrow" :aria-label="`More ${f.label.toLowerCase()}`" :disabled="disabled || custom[f.key] >= f.max" @click="spin(f.key, 1, f.max)">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 9l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <span class="ltc__val">{{ String(custom[f.key]).padStart(2, '0') }}</span>
          <button type="button" class="ltc__arrow" :aria-label="`Fewer ${f.label.toLowerCase()}`" :disabled="disabled || custom[f.key] <= 0" @click="spin(f.key, -1, f.max)">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 5l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <span class="ltc__label">{{ f.label }}</span>
        </div>
      </div>
      <div class="ltc__row">
        <button type="button" class="ltc__btn ltc__btn--remove" :disabled="disabled || customTotal < 1" @click="applyCustom(-1)">− Remove {{ customLabel }}</button>
        <button type="button" class="ltc__btn ltc__btn--add" :disabled="disabled || customTotal < 1" @click="applyCustom(1)">+ Add {{ customLabel }}</button>
      </div>
    </div>

    <p v-if="paused" class="ltc__hint">Resume the lock to change its time.</p>

    <div class="ltc__row">
      <button type="button" class="ltc__btn ltc__btn--pause" :disabled="pending" @click="emit('toggle-pause')">
        {{ paused ? 'Resume' : 'Pause' }}
      </button>
      <button type="button" class="ltc__btn ltc__btn--end" :disabled="pending" @click="emit('end')">End lock</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { spanMinutes } from '~/utils/lockHistory'

const props = defineProps<{
  paused: boolean
  pending: boolean
  /** Changes the timer; resolves true when it went through. */
  adjust: (deltaMinutes: number) => Promise<boolean>
}>()

const emit = defineEmits<{ 'toggle-pause': []; 'end': [] }>()

const QUICK = [
  { minutes: -60, label: '−1h' },
  { minutes: -15, label: '−15m' },
  { minutes: 15, label: '+15m' },
  { minutes: 60, label: '+1h' },
]
type Field = 'days' | 'hours' | 'minutes'
const FIELDS: { key: Field; label: string; max: number }[] = [
  { key: 'days', label: 'Days', max: 7 },
  { key: 'hours', label: 'Hours', max: 23 },
  { key: 'minutes', label: 'Min', max: 59 },
]

// The server only changes the time of a running lock.
const disabled = computed(() => props.pending || props.paused)
const customOpen = ref(false)
const custom = reactive<Record<Field, number>>({ days: 0, hours: 0, minutes: 0 })
const customTotal = computed(() => custom.days * 1440 + custom.hours * 60 + custom.minutes)
const customLabel = computed(() => [
  custom.days && `${custom.days}d`, custom.hours && `${custom.hours}h`, custom.minutes && `${custom.minutes}m`,
].filter(Boolean).join(' '))

function spin(key: Field, delta: number, max: number) {
  custom[key] = Math.max(0, Math.min(max, custom[key] + delta))
}

function apply(minutes: number) {
  return props.adjust(minutes)
}

async function applyCustom(dir: 1 | -1) {
  if (customTotal.value < 1) return
  // Reset on success so a second click can't silently re-apply it.
  if (await props.adjust(customTotal.value * dir)) {
    custom.days = 0
    custom.hours = 0
    custom.minutes = 0
    customOpen.value = false
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/lock-dashboard' as *;

.ltc {
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__quick { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }

  &__q {
    @include dash-btn;
    min-height: 44px;
    padding: 0 4px;
    font-variant-numeric: tabular-nums;

    &--remove { color: var(--color-remove); border-color: rgba(var(--color-remove-rgb), 0.35); }
    &--add { color: var(--color-accent); border-color: rgba(var(--color-accent-rgb), 0.35); }
    &--custom { color: var(--color-text-muted); font-weight: 500; }
  }

  &__custom {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-radius: 14px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
  }

  &__spinners { display: flex; justify-content: center; gap: 12px; }
  &__spin { display: flex; flex-direction: column; align-items: center; gap: 2px; }

  &__arrow {
    width: 44px;
    height: 32px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    &:hover:not(:disabled) { color: var(--color-accent); background: rgba(var(--color-accent-rgb), 0.07); }
    &:focus-visible { outline: 2px solid var(--color-accent); }
    &:disabled { opacity: 0.25; cursor: default; }
  }

  &__val { font-family: var(--font-display); font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-text); }
  &__label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-muted); }

  &__hint { margin: 0; font-size: 13px; font-weight: 600; color: var(--color-warn); }

  &__row { display: flex; gap: 8px; }

  &__btn {
    @include dash-btn;
    flex: 1;
    min-height: 44px;

    &--add { background: var(--gradient-brand); border-color: transparent; color: var(--color-on-accent); }
    &--remove { color: var(--color-remove); border-color: rgba(var(--color-remove-rgb), 0.35); }
    &--pause { background: var(--color-elevated); }
    &--end { color: var(--color-remove); border-color: rgba(var(--color-remove-rgb), 0.5); }
  }
}
</style>
