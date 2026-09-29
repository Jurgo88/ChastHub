<script setup lang="ts">
import logoIcon from '~/assets/images/logos/chasthub-logo-nobg.webp'
import type { FeedEntry } from '~/composables/usePublicLoq'

defineProps<{
  countdown: string
  visitorAddHours: number
  visitorPermission: 'add' | 'remove' | 'both'
  locked: boolean
  isPaused: boolean
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
  return `${Math.floor(s / 60)}m ago`
}
</script>

<template>
  <div class="loq-clock">
    <div class="loq-clock__float">
      <img :src="logoIcon" alt="" class="loq-clock__float-logo" />
    </div>

    <div class="loq-clock__bubble">
      <p class="loq-clock__label-top">TIME REMAINING</p>
      <div
        class="loq-clock__countdown"
        :class="{ 'loq-clock__countdown--ended': !locked, 'loq-clock__countdown--paused': locked && isPaused }"
      >
        {{ countdown || '…' }}
      </div>
      <p v-if="locked && isPaused" class="loq-clock__paused-badge">⏸ Paused</p>
      <p v-else class="loq-clock__label-bottom">LOCKED SESSION</p>
    </div>

    <div v-if="locked" class="loq-clock__actions">
      <div class="loq-clock__btn-row">
        <button
          v-if="visitorPermission !== 'remove'"
          class="loq-clock__add-btn"
          :class="{ 'loq-clock__add-btn--success': lastAction === 'add' }"
          :disabled="!!adjustTimeLoading || alreadyActed"
          @click="$emit('adjustTime', 'add')"
        >
          <span v-if="lastAction === 'add'">+{{ visitorAddHours }}h added ✓</span>
          <span v-else-if="adjustTimeLoading === 'add'">Adding…</span>
          <span v-else>+ {{ visitorAddHours }}h</span>
        </button>
        <button
          v-if="visitorPermission !== 'add'"
          class="loq-clock__add-btn loq-clock__add-btn--remove"
          :class="{ 'loq-clock__add-btn--success': lastAction === 'remove' }"
          :disabled="!!adjustTimeLoading || alreadyActed"
          @click="$emit('adjustTime', 'remove')"
        >
          <span v-if="lastAction === 'remove'">−{{ visitorAddHours }}h removed ✓</span>
          <span v-else-if="adjustTimeLoading === 'remove'">Removing…</span>
          <span v-else>− {{ visitorAddHours }}h</span>
        </button>
      </div>
      <p v-if="actionError" class="loq-clock__error">{{ actionError }}</p>

      <TransitionGroup v-if="feed.length" name="feed" tag="ul" class="loq-clock__feed">
        <li v-for="entry in feed" :key="entry.id" class="loq-clock__feed-item">
          <span :class="entry.direction === 'remove' ? 'loq-clock__feed-remove' : 'loq-clock__feed-add'">
            {{ entry.direction === 'remove' ? '−' : '+' }}{{ entry.hours }}h
          </span>
          <span class="loq-clock__feed-label">{{ entry.direction === 'remove' ? 'removed' : 'added' }} · {{ feedAgo(entry.at) }}</span>
        </li>
      </TransitionGroup>
    </div>

    <div v-else class="loq-clock__ended-label">
      This lock has ended
    </div>
  </div>
</template>

<style scoped lang="scss">
.loq-clock {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.75rem;
  text-align: center;
  width: 100%;
  max-width: 360px;

  &__float {
    animation: float 4s ease-in-out infinite;
  }

  &__float-logo {
    width: clamp(54px, 13vw, 74px);
    height: auto;
    display: block;
    filter:
      brightness(1.5)
      drop-shadow(0 0 10px rgba(80, 140, 255, 0.65))
      drop-shadow(0 0 28px rgba(0, 68, 255, 0.35));
  }

  &__bubble {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2.25rem 2rem;
    background: linear-gradient(
      160deg,
      rgba(255, 255, 255, 0.04) 0%,
      rgba(255, 255, 255, 0.015) 100%
    );
    border: 1px solid rgba(80, 120, 255, 0.18);
    border-top-color: rgba(140, 170, 255, 0.22);
    border-radius: 24px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.3),
      0 8px 40px rgba(0, 0, 0, 0.35),
      0 0 60px rgba(0, 68, 255, 0.07),
      inset 0 1px 0 rgba(255, 255, 255, 0.07);
  }

  &__label-top {
    margin: 0;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.3em;
    color: #555570;
    text-transform: uppercase;
  }

  &__countdown {
    font-family: var(--font-sans);
    font-size: clamp(2.75rem, 11vw, 5.25rem);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
    line-height: 1;
    color: #c8d4ff;
    text-shadow:
      0 0 24px rgba(0, 68, 255, 0.55),
      0 0 48px rgba(0, 68, 255, 0.2),
      0 2px 0 rgba(0, 0, 0, 0.4);
    animation: glow-pulse 5s ease-in-out infinite;
    padding: 0.25rem 0;

    &--ended {
      color: #3a3a55;
      text-shadow: none;
      animation: none;
    }

    &--paused {
      color: #ffaa5c;
      text-shadow: 0 0 20px rgba(255, 170, 0, 0.35);
      animation: none;
    }
  }

  &__label-bottom {
    margin: 0;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.22em;
    color: #4466cc;
    text-transform: uppercase;
    opacity: 0.8;
  }

  &__paused-badge {
    margin: 0;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: #ffaa5c;
    text-transform: uppercase;
  }

  &__actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.625rem;
  }

  &__btn-row {
    display: flex;
    gap: 0.625rem;
  }

  &__add-btn {
    padding: 0.5rem 1.5rem;
    background: rgba(0, 68, 255, 0.07);
    border: 1px solid rgba(80, 120, 255, 0.35);
    border-radius: 100px;
    color: #8aabff;
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: background 0.2s, box-shadow 0.2s, border-color 0.2s, color 0.2s, transform 0.15s;
    box-shadow: 0 0 12px rgba(0, 68, 255, 0.12);
    white-space: nowrap;

    &:hover:not(:disabled) {
      background: rgba(0, 68, 255, 0.14);
      border-color: rgba(100, 150, 255, 0.6);
      box-shadow: 0 0 20px rgba(0, 68, 255, 0.35);
      color: #ccd9ff;
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &--success {
      border-color: rgba(0, 210, 80, 0.5);
      color: #00dd55;
      background: rgba(0, 210, 80, 0.06);
      box-shadow: 0 0 14px rgba(0, 210, 80, 0.2);
    }

    // Remove side uses a warm tone to read as distinct from add — same
    // neon-orange family the dashboards use for remove/end actions (TASK-061).
    &--remove {
      background: rgba(255, 102, 0, 0.07);
      border-color: rgba(255, 140, 60, 0.35);
      color: #ff9a5c;
      box-shadow: 0 0 12px rgba(255, 102, 0, 0.12);

      &:hover:not(:disabled) {
        background: rgba(255, 102, 0, 0.14);
        border-color: rgba(255, 150, 80, 0.6);
        box-shadow: 0 0 20px rgba(255, 102, 0, 0.35);
        color: #ffb480;
      }
    }
  }

  &__error {
    font-size: 0.8125rem;
    color: #cc3333;
    margin: 0;
  }

  &__feed {
    list-style: none;
    margin: 0.25rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    width: 100%;
  }

  &__feed-item {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
  }

  &__feed-add { color: #8aabff; font-weight: 700; font-variant-numeric: tabular-nums; }
  &__feed-remove { color: #ff9a5c; font-weight: 700; font-variant-numeric: tabular-nums; }

  &__feed-label {
    color: #555570;
    letter-spacing: 0.02em;
  }

  &__ended-label {
    font-size: 0.9rem;
    color: #3a3a55;
    letter-spacing: 0.05em;
  }
}

.feed-enter-active,
.feed-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.feed-enter-from { opacity: 0; transform: translateY(-6px); }
.feed-leave-to { opacity: 0; }
.feed-leave-active { position: absolute; }

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

@keyframes glow-pulse {
  0%, 100% {
    text-shadow: 0 0 24px rgba(0, 68, 255, 0.55), 0 0 48px rgba(0, 68, 255, 0.2), 0 2px 0 rgba(0, 0, 0, 0.4);
  }
  50% {
    text-shadow: 0 0 32px rgba(0, 68, 255, 0.8), 0 0 64px rgba(0, 68, 255, 0.35), 0 2px 0 rgba(0, 0, 0, 0.4);
  }
}
</style>
