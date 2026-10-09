<template>
  <article
    class="lsc"
    :class="[`lsc--${loq.status}`, { 'lsc--selected': selected }]"
    :aria-label="`Lock of ${name}`"
  >
    <div class="lsc__head">
      <div class="lsc__who">
        <UserAvatar class="lsc__avatar" :avatar-url="loq.loqee?.avatar_url" :display-name="loq.loqee?.display_name" />
        <div class="lsc__id">
          <p class="lsc__name">{{ name }}</p>
          <p class="lsc__meta">
            <OnlineIndicator :user-id="loq.loqee?.id" :last-seen-at="loq.loqee?.last_seen_at" />
            <span v-if="loq.emotion" class="lsc__mood">{{ emotionEmoji(loq.emotion) }}</span>
          </p>
        </div>
      </div>
      <span class="loq-status-pill" :class="`loq-status-pill--${loq.status}`">
        <span class="loq-status-pill__dot" />
        {{ loq.status.toUpperCase() }}
      </span>
    </div>

    <div class="lsc__time">
      <LockCountdown
        class="lsc__timer"
        compact
        :locked-until="loq.loqed_until"
        :paused-at="loq.paused_at"
        @expired="emit('expired')"
      />
      <p class="lsc__ends">{{ endsLabel(loq, now) }}</p>
      <div
        class="lsc__bar"
        role="progressbar"
        :aria-valuenow="progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Time served"
      >
        <span class="lsc__fill" :style="{ width: `${progress}%` }" />
      </div>
    </div>

    <ul class="lsc__chips" aria-label="Status">
      <li v-for="c in chips" :key="c.label" class="lock-chip" :class="`lock-chip--${c.tone}`">{{ c.label }}</li>
    </ul>

    <Transition name="lsc-flash">
      <p v-if="flash" class="lsc__flash" role="status">{{ flash }}</p>
    </Transition>
    <p v-if="error" class="lsc__err">{{ error }}</p>

    <div class="lsc__actions">
      <button
        type="button"
        class="lsc__btn"
        :disabled="pending || loq.status !== 'active'"
        :title="loq.status !== 'active' ? 'Resume the lock to change its time' : undefined"
        @click="emit('add-hour')"
      >+1h</button>
      <button type="button" class="lsc__btn" :disabled="pending" @click="emit('toggle-pause')">
        {{ loq.status === 'paused' ? 'Resume' : 'Pause' }}
      </button>
      <button
        type="button"
        class="lsc__btn lsc__btn--open"
        :aria-pressed="selected"
        @click="emit('open')"
      >
        Open
        <span v-if="waiting" class="lsc__badge" :aria-label="`${waiting} waiting`">{{ waiting }}</span>
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Loq, LockSignals } from '~/types'
import { endsLabel, lockProgress, lockSignalChips, waitingCount } from '~/utils/lockDashboard'

type CardLoq = Loq & Partial<LockSignals> & {
  loqee: { id: string; display_name: string | null; avatar_url: string | null; last_seen_at?: string | null } | null
}

const props = defineProps<{
  loq: CardLoq
  now: number
  selected?: boolean
  pending?: boolean
  flash?: string
  error?: string
}>()

const emit = defineEmits<{
  'open': []
  'add-hour': []
  'toggle-pause': []
  'expired': []
}>()

const name = computed(() => props.loq.loqee?.display_name ?? 'Unknown')
const progress = computed(() => lockProgress(props.loq, props.now))
const chips = computed(() => lockSignalChips(props.loq, 3, props.now))
const waiting = computed(() => waitingCount(props.loq))
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/lock-dashboard' as *;

.lsc {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border-radius: 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  transition: border-color 0.15s, box-shadow 0.15s;

  &--paused { border-color: rgba(var(--color-warn-rgb), 0.3); }

  &--selected {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 1px var(--color-accent);
  }

  &__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  &__who { display: flex; align-items: center; gap: 12px; min-width: 0; }
  &__avatar { @include avatar(44px); }
  &__id { min-width: 0; }

  &__name {
    margin: 0;
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 600;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    margin: 2px 0 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  &__mood { font-size: 14px; line-height: 1; }

  &__time { display: flex; flex-direction: column; gap: 4px; }

  &__timer :deep(.lc-compact__time) {
    font-family: var(--font-display);
    font-size: clamp(26px, 4vw, 32px);
    font-weight: 600;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
  }

  &__ends { margin: 0; font-size: 12px; color: var(--color-text-muted); }

  &__bar { @include progress-bar; margin-top: 8px; }
  &__fill { @include progress-fill; }
  &--paused &__fill { background: var(--color-text-muted); }

  &__chips { @include chip-list; }

  &__flash { margin: 0; font-size: 13px; font-weight: 600; color: var(--color-accent); }
  &__err { margin: 0; font-size: 13px; color: var(--color-danger); }

  &__actions {
    display: flex;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--color-border);
  }

  &__btn {
    @include dash-btn;

    &--open {
      margin-left: auto;
      background: var(--color-elevated);
      border-color: var(--color-elevated);
      &:hover:not(:disabled) { border-color: var(--color-accent); }
    }
  }

  &__badge {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    box-sizing: border-box;
    border-radius: 10px;
    background: var(--color-warn);
    color: var(--color-on-accent);
    font-size: 11px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}

.lsc-flash-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.lsc-flash-leave-active { transition: opacity 0.3s ease; }
.lsc-flash-enter-from { opacity: 0; transform: translateY(4px); }
.lsc-flash-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .lsc, .lsc-flash-enter-active, .lsc-flash-leave-active { transition: none; }
}
</style>
