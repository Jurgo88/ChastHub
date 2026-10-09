<template>
  <button type="button" class="lrow" :class="`lrow--${loq.status}`" @click="emit('open')">
    <UserAvatar class="lrow__avatar" :avatar-url="loq.loqee?.avatar_url" :display-name="loq.loqee?.display_name" />
    <span class="lrow__body">
      <span class="lrow__top">
        <span class="lrow__name">{{ loq.loqee?.display_name ?? 'Unknown' }}</span>
        <LockCountdown
          class="lrow__timer"
          compact
          :locked-until="loq.loqed_until"
          :paused-at="loq.paused_at"
          @expired="emit('expired')"
        />
      </span>
      <span class="lrow__bar" aria-hidden="true"><span class="lrow__fill" :style="{ width: `${progress}%` }" /></span>
      <span class="lrow__note" :class="`lrow__note--${chip.tone}`">
        {{ loq.status === 'paused' ? 'Paused' : chip.label }}<template v-if="waiting"> · {{ waiting }} waiting</template>
      </span>
    </span>
    <svg class="lrow__chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
  </button>
</template>

<script setup lang="ts">
import type { Loq, LockSignals } from '~/types'
import { lockProgress, lockSignalChips, waitingCount } from '~/utils/lockDashboard'

type RowLoq = Loq & Partial<LockSignals> & {
  loqee: { id: string; display_name: string | null; avatar_url: string | null } | null
}

const props = defineProps<{ loq: RowLoq; now: number }>()
const emit = defineEmits<{ open: []; expired: [] }>()

const progress = computed(() => lockProgress(props.loq, props.now))
const chip = computed(() => lockSignalChips(props.loq, 1, props.now)[0] ?? { label: '', tone: 'idle' as const })
const waiting = computed(() => waitingCount(props.loq))
</script>

<style scoped lang="scss">
@use '~/assets/styles/lock-dashboard' as *;

.lrow {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover { border-color: var(--color-elevated); }
  &:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

  &__avatar { @include avatar(44px); }
  &__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  &__top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }

  &__name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__timer :deep(.lc-compact__time) {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--color-text);
  }
  &__timer :deep(.lc-compact__paused) { display: none; }

  &__bar { @include progress-bar; height: 4px; }
  &__fill { @include progress-fill; }
  &--paused &__fill { background: var(--color-text-muted); }

  &__note { font-size: 12px; }
  &__note--ok   { color: var(--color-success); }
  &__note--warn { color: var(--color-warn); }
  &__note--due  { color: var(--color-accent); }
  &__note--idle { color: var(--color-text-muted); }

  &__chev { flex-shrink: 0; color: var(--color-text-muted); }
}
</style>
