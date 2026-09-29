<script setup lang="ts">
// TASK-151 — 🔒 and 🔓 were the only thing marking locked from unlocked here,
// and they are the two emoji that differ most between platforms: grey on
// Windows, blue-grey on Android, gold on iOS. The pause glyph stays as text —
// there is no artwork for it, and ⏸ is a geometric symbol rather than an
// emoji, so it renders consistently.
import loqedIcon from '~/assets/images/icons/state-loqed.webp'
import unloqedIcon from '~/assets/images/icons/state-unloqed.webp'

const props = defineProps<{
  lockedUntil: string | null
  pausedAt?: string | null
  compact?: boolean
  bubble?: boolean
  hero?: boolean
  expanded?: boolean
}>()

const emit = defineEmits<{
  expired: []
}>()

const countdown = ref('')
const parts = ref({ d: 0, h: 0, m: 0, s: 0 })
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
let interval: ReturnType<typeof setInterval> | null = null

const localTime = computed(() => {
  if (!props.lockedUntil) return ''
  return new Date(props.lockedUntil).toLocaleString(undefined, { timeZone: timezone })
})

function formatMs(ms: number): string {
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function tick() {
  if (!props.lockedUntil) { countdown.value = ''; return }
  const ms = props.pausedAt
    ? new Date(props.lockedUntil).getTime() - new Date(props.pausedAt).getTime()
    : new Date(props.lockedUntil).getTime() - Date.now()
  if (ms <= 0) {
    countdown.value = 'Unlocked'
    if (interval) { clearInterval(interval); interval = null }
    emit('expired')
  }
  else {
    countdown.value = formatMs(ms)
    parts.value = {
      d: Math.floor(ms / 86_400_000),
      h: Math.floor((ms % 86_400_000) / 3_600_000),
      m: Math.floor((ms % 3_600_000) / 60_000),
      s: Math.floor((ms % 60_000) / 1_000),
    }
  }
}

watch([() => props.lockedUntil, () => props.pausedAt], () => {
  if (interval) { clearInterval(interval); interval = null }
  if (!props.lockedUntil) { countdown.value = ''; return }
  tick()
  if (!props.pausedAt) {
    interval = setInterval(tick, 1_000)
  }
}, { immediate: true })

onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>

<template>
  <!-- Bubble: prominent centered display for loqholder cards -->
  <div v-if="bubble" class="lc-bubble" :class="{ 'lc-bubble--paused': pausedAt }">
    <template v-if="lockedUntil">
      <div class="lc-bubble__segments">
        <div class="lc-seg">
          <span class="lc-seg__val">{{ String(parts.d).padStart(2, '0') }}</span>
          <span class="lc-seg__label">Days</span>
        </div>
        <span class="lc-bubble__sep">:</span>
        <div class="lc-seg">
          <span class="lc-seg__val">{{ String(parts.h).padStart(2, '0') }}</span>
          <span class="lc-seg__label">Hours</span>
        </div>
        <span class="lc-bubble__sep">:</span>
        <div class="lc-seg">
          <span class="lc-seg__val">{{ String(parts.m).padStart(2, '0') }}</span>
          <span class="lc-seg__label">Min</span>
        </div>
        <span class="lc-bubble__sep lc-bubble__sep--sm">:</span>
        <div class="lc-seg lc-seg--sm">
          <span class="lc-seg__val">{{ String(parts.s).padStart(2, '0') }}</span>
          <span class="lc-seg__label">Sec</span>
        </div>
      </div>
      <span v-if="pausedAt" class="lc-bubble__paused-label">⏸ Paused</span>
    </template>
    <span v-else class="lc-bubble__unlocked"><img :src="unloqedIcon" class="lc-icon" alt="" width="128" height="128" decoding="async"> Unlocked</span>
  </div>

  <!-- Hero: morphs between compact (desktop collapsed) and bubble (desktop expanded / always on mobile) -->
  <div v-else-if="hero" class="lc-hero" :class="{ 'lc-hero--expanded': expanded, 'lc-hero--paused': pausedAt }">
    <template v-if="lockedUntil">
      <div class="lc-hero__segs">
        <div class="lc-seg">
          <span class="lc-seg__val">{{ String(parts.d).padStart(2, '0') }}</span>
          <span class="lc-seg__label">Days</span>
        </div>
        <span class="lc-hero__sep">:</span>
        <div class="lc-seg">
          <span class="lc-seg__val">{{ String(parts.h).padStart(2, '0') }}</span>
          <span class="lc-seg__label">Hours</span>
        </div>
        <span class="lc-hero__sep">:</span>
        <div class="lc-seg">
          <span class="lc-seg__val">{{ String(parts.m).padStart(2, '0') }}</span>
          <span class="lc-seg__label">Min</span>
        </div>
        <span class="lc-hero__sep lc-hero__sep--sm">:</span>
        <div class="lc-seg lc-seg--sm">
          <span class="lc-seg__val">{{ String(parts.s).padStart(2, '0') }}</span>
          <span class="lc-seg__label">Sec</span>
        </div>
      </div>
      <span v-if="pausedAt" class="lc-hero__paused-label">⏸ Paused</span>
    </template>
    <span v-else class="lc-hero__unlocked"><img :src="unloqedIcon" class="lc-icon" alt="" width="128" height="128" decoding="async"> Unlocked</span>
  </div>

  <!-- Compact: single line for card lists -->
  <div v-else-if="compact" class="lc-compact">
    <span class="lc-compact__time" :class="{ 'lc-compact__time--paused': pausedAt }">{{ countdown }}</span>
    <span v-if="pausedAt" class="lc-compact__paused">⏸ paused</span>
  </div>

  <!-- Full: centred block for single-loq views -->
  <div v-else class="lock-countdown" >
    <template v-if="lockedUntil">
      <div class="lock-countdown__badge lock-countdown__badge--locked"><img :src="loqedIcon" class="lc-icon" alt="" width="128" height="128" decoding="async"> Locked</div>
      <div class="lock-countdown__remaining" :class="{ 'lock-countdown__remaining--paused': pausedAt }">
        {{ countdown }}
      </div>
      <div class="lock-countdown__meta">
        <template v-if="pausedAt">⏸ Paused</template>
        <template v-else>Until {{ localTime }} <span class="lock-countdown__tz">({{ timezone }})</span></template>
      </div>
    </template>
    <template v-else>
      <div class="lock-countdown__badge lock-countdown__badge--unlocked"><img :src="unloqedIcon" class="lc-icon" alt="" width="128" height="128" decoding="async"> Unlocked</div>
    </template>
  </div>
</template>

<style scoped lang="scss">
// ── Bubble (loqholder cards) ────────────────────────────────────────────────

.lc-bubble {
  width: 100%;
  background: rgba(var(--color-accent-rgb, 99, 102, 241), 0.05);
  border: 1.5px solid rgba(var(--color-accent-rgb, 99, 102, 241), 0.18);
  border-radius: 0.875rem;
  padding: 1.5rem 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  box-sizing: border-box;

  &--paused {
    background: rgba(255, 170, 0, 0.04);
    border-color: rgba(255, 170, 0, 0.2);
  }

  &__segments {
    display: flex;
    align-items: flex-start;
    gap: 0.375rem;
  }

  &__sep {
    font-size: 2.25rem;
    font-weight: 300;
    color: var(--color-border);
    line-height: 1;
    margin-top: 0.375rem;
    user-select: none;

    &--sm {
      font-size: 1.5rem;
      margin-top: 0.75rem;
    }
  }

  &__paused-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #ffaa00;
    letter-spacing: 0.03em;
  }

  &__unlocked {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #22c55e;
  }
}

.lc-seg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;

  &__val {
    font-family: var(--font-mono);
    font-size: 2.75rem;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    letter-spacing: -2px;
    line-height: 1;
    color: var(--color-accent);
    text-shadow: 0 0 20px rgba(var(--color-accent-rgb, 99, 102, 241), 0.35);

    .lc-bubble--paused & {
      color: #ffaa00;
      text-shadow: 0 0 16px rgba(255, 170, 0, 0.3);
    }
  }

  &__label {
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--color-muted);
  }

  &--sm &__val {
    font-size: 1.5rem;
    letter-spacing: -0.5px;
    color: var(--color-muted);

    .lc-bubble--paused & { color: var(--color-border); }
  }

  &--sm &__label {
    font-size: 0.5625rem;
  }
}

// ── Hero (morphing timer) ────────────────────────────────────────────────────

@mixin hero-expanded-state {
  padding: 1.5rem 1rem 1.25rem;
  background: rgba(var(--color-accent-rgb, 99, 102, 241), 0.05);
  border-color: rgba(var(--color-accent-rgb, 99, 102, 241), 0.18);

  .lc-hero__sep {
    font-size: 2.25rem;
    margin-top: 0.375rem;

    &--sm { font-size: 1.5rem; margin-top: 0.75rem; }
  }

  .lc-seg__val {
    font-size: 2.75rem;
    letter-spacing: -2px;
    text-shadow: 0 0 20px rgba(var(--color-accent-rgb, 99, 102, 241), 0.35);
  }

  .lc-seg__label { max-height: 2rem; opacity: 1; font-size: 0.625rem; }
  .lc-seg--sm .lc-seg__label { max-height: 2rem; opacity: 1; }

  .lc-seg--sm .lc-seg__val {
    font-size: 1.5rem;
    color: var(--color-muted);
    text-shadow: none;
  }
}

.lc-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.875rem;
  border: 1.5px solid transparent;
  background: transparent;
  box-sizing: border-box;
  transition:
    padding 0.38s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.38s ease,
    border-color 0.38s ease;

  &__segs {
    display: flex;
    align-items: flex-start;
    gap: 0.375rem;
  }

  &__sep {
    font-size: 1.5rem;
    font-weight: 300;
    color: var(--color-border);
    line-height: 1;
    margin-top: 0.2rem;
    user-select: none;
    transition: font-size 0.38s cubic-bezier(0.4, 0, 0.2, 1), margin-top 0.38s ease;

    &--sm { font-size: 1rem; margin-top: 0.45rem; }
  }

  &__paused-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #ffaa00;
  }

  &__unlocked {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #22c55e;
  }

  // Segment overrides for compact state
  .lc-seg__val {
    font-size: 1.75rem;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.5px;
    line-height: 1;
    color: var(--color-accent);
    text-shadow: none;
    transition:
      font-size 0.38s cubic-bezier(0.4, 0, 0.2, 1),
      letter-spacing 0.38s ease,
      text-shadow 0.38s ease;
  }

  .lc-seg__label {
    max-height: 1.5rem;
    overflow: hidden;
    opacity: 0.6;
    font-size: 0.5rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--color-muted);
    transition: max-height 0.3s ease 0.05s, opacity 0.25s ease 0.05s, font-size 0.3s ease;
  }

  .lc-seg--sm .lc-seg__label {
    max-height: 0;
    opacity: 0;
  }

  .lc-seg--sm .lc-seg__val {
    font-size: 1.125rem;
    color: var(--color-muted);
    transition:
      font-size 0.38s cubic-bezier(0.4, 0, 0.2, 1),
      letter-spacing 0.38s ease;
  }

  &--paused .lc-seg__val { color: #ffaa00; }
  &--paused .lc-seg--sm .lc-seg__val { color: var(--color-muted); }

  // Expanded state (desktop when card is open)
  &--expanded { @include hero-expanded-state; }
  @at-root .lc-hero--paused.lc-hero--expanded .lc-seg__val {
    color: #ffaa00;
    text-shadow: 0 0 16px rgba(255, 170, 0, 0.3);
  }
}

// Mobile: always show expanded style regardless of --expanded class
@media (max-width: 767px) {
  .lc-hero {
    @include hero-expanded-state;
    width: 100%;
  }
}

// ── Compact (card list) ─────────────────────────────────────────────────────

.lc-compact {
  display: flex;
  align-items: baseline;
  gap: 0.625rem;

  &__time {
    font-family: var(--font-mono);
    font-size: 1.75rem;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.5px;
    color: var(--color-accent);
    text-shadow: 0 0 12px rgba(var(--color-accent-rgb), 0.25);

    &--paused { color: var(--color-muted); text-shadow: none; }
  }

  &__paused {
    font-size: 0.75rem;
    color: #ffaa00;
    font-weight: 600;
  }
}

// ── Full (single-loq view) ──────────────────────────────────────────────────

.lock-countdown {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem;
  text-align: center;

  &__badge {
    display: inline-block;
    padding: 0.25rem 0.875rem;
    border-radius: 999px;
    font-size: 0.875rem;
    font-weight: 600;

    &--locked { background: rgba(220, 38, 38, 0.12); color: #ef4444; border: 1px solid rgba(220,38,38,0.25); }
    &--unlocked { background: rgba(22, 163, 74, 0.12); color: #22c55e; border: 1px solid rgba(22,163,74,0.25); }
  }

  &__remaining {
    font-size: 2.25rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.5px;
    font-family: var(--font-mono);
    color: var(--color-accent);

    &--paused { color: var(--color-muted); }
  }

  &__meta {
    font-size: 0.8125rem;
    color: var(--color-muted);
  }

  &__tz { font-style: italic; }
}

// TASK-151 — sized in `em` so one rule serves every variant: these labels run
// from 0.875rem in the compact badge to 1.75rem in the hero, and the icon has
// to track the text in each. The negative vertical-align seats it on the
// baseline in the inline-block badges; it is inert in the flex ones.
.lc-icon {
  width: 1.15em;
  height: 1.15em;
  object-fit: contain;
  vertical-align: -0.2em;
  flex-shrink: 0;
}
</style>
