<script setup lang="ts">
import type { FeedEntry } from '~/composables/usePublicLoq'

const props = defineProps<{
  countdown: string
  visitorAddHours: number
  visitorPermission: 'add' | 'remove' | 'both'
  locked: boolean
  isPaused: boolean
  isPending?: boolean
  adjustTimeLoading: 'add' | 'remove' | null
  lastAction: 'add' | 'remove' | null
  alreadyActed: boolean
  actionError: string
  feed: FeedEntry[]
}>()

defineEmits<{
  adjustTime: [direction: 'add' | 'remove']
}>()

function feedAgo(at: number): string {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// The public API does not expose the lock's total length, so the ring does not
// claim a progress it cannot know. It sweeps with the seconds of the countdown
// instead: a live second hand that shows the clock is running.
const RING_R = 122
const RING_C = 2 * Math.PI * RING_R
const ringDash = computed(() => {
  if (!props.locked) return `0 ${RING_C}`
  const sec = Number(/(\d+)s$/.exec(props.countdown || '')?.[1] ?? 60)
  const share = props.isPaused ? 1 : Math.max(0.02, sec / 60)
  return `${(share * RING_C).toFixed(1)} ${RING_C.toFixed(1)}`
})

// Long countdowns ("3d 4h 12m 09s") need a smaller size to stay on one line.
const timeSize = computed(() => {
  const len = (props.countdown || '').length
  if (len > 13) return 'lc__time--xs'
  if (len > 10) return 'lc__time--sm'
  return ''
})

const amount = computed(() => {
  const h = props.visitorAddHours
  if (h < 1) return `${Math.round(h * 60)} min`
  return `${h} ${h === 1 ? 'hour' : 'hours'}`
})
</script>

<template>
  <div class="lc">
    <div class="lc__ring" :class="{ 'lc__ring--ended': !locked }">
      <svg viewBox="0 0 280 280" aria-hidden="true">
        <defs>
          <linearGradient id="lcGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#EB3678" />
            <stop offset="1" stop-color="#FB773C" />
          </linearGradient>
        </defs>
        <circle cx="140" cy="140" :r="RING_R" fill="none" stroke="#4F1787" stroke-width="16" />
        <circle
          cx="140" cy="140" :r="RING_R"
          fill="none" stroke="url(#lcGrad)" stroke-width="16" stroke-linecap="round"
          :stroke-dasharray="ringDash" transform="rotate(-90 140 140)" class="lc__arc"
        />
      </svg>
      <div class="lc__center">
        <span class="lc__label">{{ !locked ? 'UNLOCKED' : isPaused ? 'PAUSED' : 'UNLOCKS IN' }}</span>
        <span class="lc__time" :class="timeSize">{{ locked ? (countdown || '…') : 'Free' }}</span>
        <span v-if="locked && isPaused" class="lc__sub">The keyholder paused the clock</span>
        <span v-else-if="locked && isPending" class="lc__sub">Waiting for a keyholder to take over</span>
      </div>
    </div>

    <div v-if="locked" class="lc__actions">
      <button
        v-if="visitorPermission !== 'remove'"
        type="button"
        class="lc__btn lc__btn--add"
        :class="{ 'lc__btn--done': lastAction === 'add' }"
        :disabled="!!adjustTimeLoading || alreadyActed"
        @click="$emit('adjustTime', 'add')"
      >
        <span v-if="lastAction === 'add'">{{ amount }} added</span>
        <span v-else-if="adjustTimeLoading === 'add'">Adding…</span>
        <span v-else>Add {{ amount }}</span>
      </button>
      <button
        v-if="visitorPermission !== 'add'"
        type="button"
        class="lc__btn lc__btn--remove"
        :class="{ 'lc__btn--done': lastAction === 'remove' }"
        :disabled="!!adjustTimeLoading || alreadyActed"
        @click="$emit('adjustTime', 'remove')"
      >
        <span v-if="lastAction === 'remove'">{{ amount }} removed</span>
        <span v-else-if="adjustTimeLoading === 'remove'">Removing…</span>
        <span v-else>Show mercy · −{{ amount }}</span>
      </button>

      <p v-if="alreadyActed && !lastAction" class="lc__hint">You already made your move. Come back in an hour.</p>
      <p v-if="actionError" class="lc__error">{{ actionError }}</p>

      <TransitionGroup v-if="feed.length" name="feed" tag="ul" class="lc__feed">
        <li v-for="entry in feed" :key="entry.id" class="lc__feed-item">
          <span :class="entry.direction === 'remove' ? 'lc__feed-remove' : 'lc__feed-add'">
            {{ entry.direction === 'remove' ? '−' : '+' }}{{ entry.hours }}h
          </span>
          <span class="lc__feed-label">{{ entry.direction === 'remove' ? 'removed' : 'added' }}<template v-if="entry.name"> by <b>{{ entry.name }}</b></template> · {{ feedAgo(entry.at) }}</span>
        </li>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lc {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
}

.lc__ring {
  position: relative;
  width: min(100%, 280px);
  aspect-ratio: 1;
  filter: drop-shadow(0 20px 60px rgba(var(--color-brand-rgb), 0.35));

  svg { width: 100%; height: 100%; display: block; }
  &--ended { filter: none; opacity: 0.85; }
}
.lc__arc { transition: stroke-dasharray 0.9s linear; }

.lc__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 28px;
  text-align: center;
}
.lc__label { font-size: 12px; letter-spacing: 0.2em; color: var(--color-text-muted); font-weight: 600; }
.lc__time {
  font-family: var(--font-display);
  font-size: 44px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
  white-space: nowrap;
  &--sm { font-size: 34px; }
  &--xs { font-size: 27px; }
}
.lc__sub { font-size: 13px; color: #CFC5F2; }

.lc__actions { width: 100%; display: flex; flex-direction: column; gap: 10px; }
.lc__btn {
  width: 100%;
  height: 58px;
  border-radius: 18px;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.1s, opacity 0.15s;

  &:active:not(:disabled) { transform: scale(0.98); }
  &:disabled { cursor: not-allowed; opacity: 0.6; }

  &--add {
    border: 0;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    box-shadow: 0 10px 36px rgba(var(--color-brand-rgb), 0.4);
  }
  &--remove {
    height: 52px;
    background: rgba(24, 1, 97, 0.7);
    border: 1.5px solid var(--color-elevated);
    color: var(--color-text);
    font-size: 17px;
    font-weight: 600;
  }
  &--done:disabled { opacity: 1; }
}
.lc__hint { margin: 2px 0 0; text-align: center; font-size: 13px; color: var(--color-text-muted); }
.lc__error { margin: 2px 0 0; text-align: center; font-size: 14px; color: var(--color-danger); }

.lc__feed {
  position: relative;
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lc__feed-item { display: flex; justify-content: center; gap: 8px; font-size: 14px; }
.lc__feed-add { color: var(--color-accent); font-weight: 700; font-variant-numeric: tabular-nums; }
.lc__feed-remove { color: var(--color-cta); font-weight: 700; font-variant-numeric: tabular-nums; }
.lc__feed-label { color: var(--color-text-muted); b { color: var(--color-text); font-weight: 600; } }

.feed-enter-active,
.feed-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.feed-enter-from { opacity: 0; transform: translateY(-6px); }
.feed-leave-to { opacity: 0; }
.feed-leave-active { position: absolute; }
</style>
