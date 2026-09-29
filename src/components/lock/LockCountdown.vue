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
      <span v-if="pausedAt" class="lc-bubble__paused-label">Paused</span>
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
      <span v-if="pausedAt" class="lc-hero__paused-label">Paused</span>
    </template>
    <span v-else class="lc-hero__unlocked"><img :src="unloqedIcon" class="lc-icon" alt="" width="128" height="128" decoding="async"> Unlocked</span>
  </div>

  <!-- Compact: single line for card lists -->
  <div v-else-if="compact" class="lc-compact">
    <span class="lc-compact__time" :class="{ 'lc-compact__time--paused': pausedAt }">{{ countdown }}</span>
    <span v-if="pausedAt" class="lc-compact__paused">paused</span>
  </div>

  <!-- Full: centred block for single-loq views -->
  <div v-else class="lock-countdown" >
    <template v-if="lockedUntil">
      <div class="lock-countdown__badge lock-countdown__badge--locked"><img :src="loqedIcon" class="lc-icon" alt="" width="128" height="128" decoding="async"> Locked</div>
      <div class="lock-countdown__remaining" :class="{ 'lock-countdown__remaining--paused': pausedAt }">
        {{ countdown }}
      </div>
      <div class="lock-countdown__meta">
        <template v-if="pausedAt">Paused</template>
        <template v-else>Until {{ localTime }} <span class="lock-countdown__tz">({{ timezone }})</span></template>
      </div>
    </template>
    <template v-else>
      <div class="lock-countdown__badge lock-countdown__badge--unlocked"><img :src="unloqedIcon" class="lc-icon" alt="" width="128" height="128" decoding="async"> Unlocked</div>
    </template>
  </div>
</template>

<style scoped lang="scss">
// Timer tiles: one rounded tile per unit, digits in the display face with the
// brand gradient; amber while paused. Shared by the bubble (keyholder cards)
// and the hero (wearer card) variants.

@mixin tiles {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 8px;
  width: 100%;
}

.lc-seg {
  flex: 1 1 0;
  max-width: 108px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 6px 12px;
  border-radius: 18px;
  background: rgba(14, 0, 51, 0.55);
  border: 1px solid var(--color-border);

  &__val {
    font-family: var(--font-display);
    font-size: clamp(30px, 8vw, 46px);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    line-height: 1;
    background: var(--gradient-brand);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  &__label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--color-text-muted);
  }

  &--sm &__val {
    background: none;
    -webkit-background-clip: initial;
    background-clip: initial;
    color: var(--color-text);
  }
}

.lc-bubble,
.lc-hero {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  &__segments,
  &__segs { @include tiles; }

  // The ":" separators give way to the tiles themselves.
  &__sep { display: none; }

  &__paused-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 999px;
    background: rgba(var(--color-warn-rgb), 0.14);
    color: var(--color-warn);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  &__unlocked {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    color: var(--color-accent);
  }
}

.lc-hero__paused-label { display: none !important; } // the card's status pill already says it

.lc-bubble--paused .lc-seg,
.lc-hero--paused .lc-seg { border-color: rgba(var(--color-warn-rgb), 0.3); }
.lc-bubble--paused .lc-seg__val,
.lc-hero--paused .lc-seg__val {
  background: none;
  -webkit-background-clip: initial;
  background-clip: initial;
  color: var(--color-warn);
}

// Collapsed keyholder card on desktop: an inline, tile-less read-out that
// fits the summary row. Expanded cards and mobile always get the tiles.
@media (min-width: 768px) {
  .lc-hero:not(.lc-hero--expanded) {
    .lc-hero__segs { gap: 4px; align-items: baseline; }
    .lc-hero__sep { display: block; font-family: var(--font-display); font-size: 22px; color: var(--color-text-muted); }
    .lc-seg {
      flex: 0 0 auto;
      padding: 0;
      background: none;
      border: 0;
      max-width: none;
    }
    .lc-seg__val { font-size: 28px; }
    .lc-seg__label { display: none; }
  }
}

// ── Compact (card list) ─────────────────────────────────────────────────────

.lc-compact {
  display: flex;
  align-items: baseline;
  gap: 10px;

  &__time {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    background: var(--gradient-brand);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;

    &--paused { background: none; color: var(--color-warn); }
  }

  &__paused {
    font-size: 12px;
    color: var(--color-warn);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
}

// ── Full (single-lock view) ─────────────────────────────────────────────────

.lock-countdown {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px;
  text-align: center;

  &__badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 600;

    &--locked { background: rgba(var(--color-accent-rgb), 0.14); color: var(--color-accent); }
    &--unlocked { background: rgba(var(--color-cta-rgb), 0.14); color: var(--color-cta); }
  }

  &__remaining {
    font-family: var(--font-display);
    font-size: 40px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    color: var(--color-text);

    &--paused { color: var(--color-warn); }
  }

  &__meta {
    font-size: 14px;
    color: var(--color-text-muted);
  }

  &__tz { font-style: italic; }
}

// TASK-151: sized in `em` so the icon tracks the label in every variant.
.lc-icon {
  width: 1.15em;
  height: 1.15em;
  object-fit: contain;
  vertical-align: -0.2em;
  flex-shrink: 0;
}
</style>
