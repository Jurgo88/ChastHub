<template>
  <div class="lpr" :class="{ 'lpr--paused': !!loq.paused_at }">
    <svg class="lpr__svg" viewBox="0 0 260 260" aria-hidden="true">
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#EB3678" />
          <stop offset="1" stop-color="#FB773C" />
        </linearGradient>
      </defs>
      <circle class="lpr__track" cx="130" cy="130" :r="R" />
      <circle
        class="lpr__arc"
        cx="130"
        cy="130"
        :r="R"
        :stroke="loq.paused_at ? 'var(--color-warn)' : `url(#${gradientId})`"
        :stroke-dasharray="CIRC"
        :stroke-dashoffset="CIRC * (1 - progress / 100)"
        transform="rotate(-90 130 130)"
      />
    </svg>
    <div
      class="lpr__center"
      role="progressbar"
      :aria-valuenow="progress"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuetext="`${progress}% of the lock served`"
    >
      <span class="lpr__label">{{ loq.paused_at ? 'Paused' : 'Time left' }}</span>
      <LockCountdown class="lpr__time" compact :locked-until="loq.loqed_until" :paused-at="loq.paused_at" @expired="emit('expired')" />
      <span class="lpr__pct">{{ progress }}% done</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { lockProgress } from '~/utils/lockDashboard'

const props = defineProps<{
  loq: { created_at: string; loqed_until: string | null; paused_at?: string | null }
  now: number
}>()
const emit = defineEmits<{ expired: [] }>()

const R = 116
const CIRC = 2 * Math.PI * R
const gradientId = `lpr-${useId()}`
const progress = computed(() => lockProgress(props.loq, props.now))
</script>

<style scoped lang="scss">
.lpr {
  position: relative;
  width: min(280px, 72vw);
  aspect-ratio: 1;
  margin: 0 auto;

  &__svg { display: block; width: 100%; height: 100%; }

  &__track { fill: none; stroke: var(--color-border); stroke-width: 12; }

  &__arc {
    fill: none;
    stroke-width: 12;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.6s ease;
    @media (prefers-reduced-motion: reduce) { transition: none; }
  }

  &__center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    text-align: center;
    padding: 0 28px;
  }

  &__label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  &--paused &__label { color: var(--color-warn); }

  &__time :deep(.lc-compact) { justify-content: center; }
  &__time :deep(.lc-compact__time) {
    font-family: var(--font-display);
    font-size: clamp(22px, 6vw, 30px);
    font-weight: 600;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
  }
  &__time :deep(.lc-compact__paused) { display: none; }

  &__pct { font-size: 13px; color: var(--color-text-muted); }
}
</style>
