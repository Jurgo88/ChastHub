<template>
  <div class="wd" :class="{ 'wd--spinning': moving, 'wd--landed': winner !== null && !moving }">
    <svg viewBox="-124 -132 248 256" class="wd__svg" role="img" :aria-label="`Wheel with ${segments.length} segments`">
      <defs>
        <linearGradient :id="`${uid}-rim`" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#EB3678" />
          <stop offset="1" stop-color="#FB773C" />
        </linearGradient>
        <radialGradient :id="`${uid}-shine`" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stop-color="#fff" stop-opacity="0.28" />
          <stop offset="0.55" stop-color="#fff" stop-opacity="0" />
        </radialGradient>
        <radialGradient :id="`${uid}-hub`" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stop-color="#4F1787" />
          <stop offset="1" stop-color="#0E0033" />
        </radialGradient>
      </defs>

      <!-- Rim with a ring of bulbs -->
      <circle r="112" fill="#0E0033" :stroke="`url(#${uid}-rim)`" stroke-width="6" />
      <circle
        v-for="(b, i) in bulbs"
        :key="i"
        :cx="b.x"
        :cy="b.y"
        r="2.6"
        class="wd__bulb"
        :class="i % 2 ? 'wd__bulb--odd' : 'wd__bulb--even'"
      />

      <!-- The disc -->
      <g class="wd__disc" :style="{ transform: `rotate(${angle}deg)` }">
        <g v-for="(s, i) in slices" :key="i" class="wd__slice" :class="{ 'wd__slice--dim': winner !== null && !moving && i !== winner }">
          <path :d="s.path" :fill="s.color" stroke="rgba(14,0,51,0.9)" stroke-width="1.2" />
          <text
            :transform="`rotate(${s.mid}) translate(0 -64)`"
            class="wd__label"
            text-anchor="middle"
            dominant-baseline="middle"
          >{{ s.label }}</text>
        </g>
        <path
          v-if="winner !== null && !moving && slices[winner]"
          :d="slices[winner]!.path"
          class="wd__win"
          fill="none"
        />
        <circle :r="R" :fill="`url(#${uid}-shine)`" pointer-events="none" />
      </g>

      <!-- Hub -->
      <circle r="17" :fill="`url(#${uid}-hub)`" :stroke="`url(#${uid}-rim)`" stroke-width="3" />
      <circle r="5" fill="#F4F0FF" />

      <!-- Pointer: swings back each time a segment edge passes under it -->
      <g class="wd__pointer" :class="{ 'wd__pointer--kick': kick }">
        <path d="M-11 -128 Q0 -134 11 -128 L2 -100 Q0 -96 -2 -100 Z" fill="#F4F0FF" stroke="#0E0033" stroke-width="2" stroke-linejoin="round" />
        <circle cy="-123" r="3" fill="#EB3678" />
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { segmentArcs, segmentLabel, type WheelSegment, type WheelSegmentType } from '~/utils/wheel'

const props = defineProps<{ segments: WheelSegment[] }>()

const COLORS: Record<WheelSegmentType, string> = {
  add: '#EB3678',
  remove: '#2E9E78',
  freeze: '#3C7DE0',
  task: '#FB773C',
  nothing: '#5B4A9E',
}
const R = 100
const BULBS = 24
const uid = `wd-${useId()}`

function point(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180
  return `${(r * Math.sin(rad)).toFixed(2)} ${(-r * Math.cos(rad)).toFixed(2)}`
}

const arcs = computed(() => segmentArcs(props.segments))

const slices = computed(() => props.segments.map((s, i) => {
  const { start, end, mid } = arcs.value[i]!
  const large = end - start > 180 ? 1 : 0
  // A single full circle cannot be drawn as one arc, but a wheel always has 4+ segments.
  const path = `M0 0 L${point(start, R)} A${R} ${R} 0 ${large} 1 ${point(end, R)} Z`
  const label = segmentLabel(s)
  return { path, mid, color: COLORS[s.type], label: label.length > 12 ? `${label.slice(0, 11)}…` : label }
}))

const bulbs = Array.from({ length: BULBS }, (_, i) => {
  const rad = (i / BULBS) * 2 * Math.PI
  return { x: +(106 * Math.sin(rad)).toFixed(2), y: +(-106 * Math.cos(rad)).toFixed(2) }
})

// ─── Motion ────────────────────────────────────────────────────────────────
// Driven frame by frame, not by a CSS transition, so the wheel can start
// turning the moment it is pressed (while the server draws the result) and
// then slow down onto whatever came out, without a jump in speed.

const angle = ref(0)
const moving = ref(false)
const winner = ref<number | null>(null)
const kick = ref(false)

/** Top speed, degrees per millisecond (≈ 2.5 turns a second). */
const MAX_V = 0.9
/** How fast it gets there, degrees per ms². */
const ACCEL = 0.002

let mode: 'idle' | 'free' | 'land' = 'idle'
let velocity = 0
let raf = 0
let lastT = 0
let landing: { from: number; to: number; start: number; dur: number; resolve: () => void } | null = null
let lastSegment = -1
let kickTimer: ReturnType<typeof setTimeout> | null = null

const mod = (a: number, n: number) => ((a % n) + n) % n
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3
const reducedMotion = () => import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Index of the segment under the pointer at the top. */
function segmentAtPointer(): number {
  const at = mod(-angle.value, 360)
  const i = arcs.value.findIndex(a => at >= a.start && at < a.end)
  return i === -1 ? arcs.value.length - 1 : i
}

function tick() {
  const seg = segmentAtPointer()
  if (seg === lastSegment) return
  lastSegment = seg
  kick.value = true
  if (kickTimer) clearTimeout(kickTimer)
  kickTimer = setTimeout(() => { kick.value = false }, 70)
}

function frame(t: number) {
  const dt = lastT ? Math.min(t - lastT, 50) : 16
  lastT = t
  if (mode === 'free') {
    velocity = Math.min(MAX_V, velocity + ACCEL * dt)
    angle.value += velocity * dt
  }
  else if (mode === 'land' && landing) {
    const p = landing.dur > 0 ? Math.min(1, (t - landing.start) / landing.dur) : 1
    angle.value = landing.from + (landing.to - landing.from) * easeOutCubic(p)
    if (p >= 1) {
      const done = landing.resolve
      landing = null
      angle.value = mod(angle.value, 360)
      mode = 'idle'
      velocity = 0
      moving.value = false
      done()
    }
  }
  tick()
  if (mode !== 'idle') raf = requestAnimationFrame(frame)
}

function run() {
  if (raf) cancelAnimationFrame(raf)
  lastT = 0
  raf = requestAnimationFrame(frame)
}

/** Starts turning and keeps going until land() or stop(). */
function spin() {
  winner.value = null
  moving.value = true
  if (mode === 'idle') velocity = 0
  mode = 'free'
  run()
}

/**
 * Slows down onto segment `index`, at a random spot inside it (not dead
 * centre, which looks staged). The ease-out starts at the current speed, so
 * the slowdown never jerks; its length follows from the distance.
 */
function land(index: number): Promise<void> {
  const arc = arcs.value[index]
  if (!arc) return Promise.resolve()
  if (mode === 'idle') { velocity = MAX_V; moving.value = true }
  const size = arc.end - arc.start
  const target = arc.start + size * (0.2 + Math.random() * 0.6)
  const from = angle.value
  const v = Math.max(velocity, 0.3)
  // At least ~3 more turns, then whatever it takes to bring `target` to the top.
  const base = from + Math.max(1080, (v * 4200) / 3)
  const to = base + mod(-target - base, 360)
  const dur = reducedMotion() ? 0 : (3 * (to - from)) / v
  return new Promise((resolve) => {
    landing = { from, to: reducedMotion() ? from + mod(-target - from, 360) : to, start: performance.now(), dur, resolve: () => {
      winner.value = index
      if (import.meta.client) navigator.vibrate?.(30)
      resolve()
    } }
    mode = 'land'
    run()
  })
}

/** Coasts to a stop wherever it is (e.g. the spin request failed). */
function stop(): Promise<void> {
  if (mode === 'idle') return Promise.resolve()
  const from = angle.value
  const v = Math.max(velocity, 0.1)
  const dur = reducedMotion() ? 0 : 900
  return new Promise((resolve) => {
    landing = { from, to: from + (v * dur) / 3, start: performance.now(), dur, resolve }
    mode = 'land'
    run()
  })
}

/** Turns straight to a segment and marks it, no animation (e.g. the last result). */
function show(index: number) {
  const arc = arcs.value[index]
  if (!arc || mode !== 'idle') return
  angle.value = mod(-arc.mid, 360)
  lastSegment = index
  winner.value = index
}

function clear() {
  winner.value = null
}

defineExpose({ spin, land, stop, show, clear })

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  if (kickTimer) clearTimeout(kickTimer)
})
</script>

<style scoped lang="scss">
.wd {
  width: 100%;
  max-width: 320px;
  margin: 0 auto;

  &__svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
    filter: drop-shadow(0 18px 40px rgba(235, 54, 120, 0.25));
  }

  &__disc { transform-origin: 0 0; will-change: transform; }

  &__label { font: 700 8.5px var(--font-display); fill: #fff; pointer-events: none; }

  &__slice { transition: opacity 0.35s ease; }
  &__slice--dim { opacity: 0.35; }

  &__win {
    stroke: #F4F0FF;
    stroke-width: 3;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 6px rgba(244, 240, 255, 0.9));
    animation: wd-glow 1.2s ease-in-out 3;
  }

  // Bulbs idle as a soft glow, chase while spinning, flash on the result.
  &__bulb { fill: #FFB020; opacity: 0.55; }

  &--spinning &__bulb { animation: wd-chase 0.36s steps(1) infinite; }
  &--spinning &__bulb--odd { animation-delay: 0.18s; }
  &--landed &__bulb { animation: wd-flash 0.3s steps(1) 6; }
  &--landed &__bulb--odd { animation-delay: 0.15s; }

  &__pointer {
    transform-origin: 0 -126px;
    transform-box: view-box;
    transition: transform 0.12s ease-out;
  }
  &__pointer--kick { transform: rotate(-16deg); transition-duration: 0.04s; }
}

@keyframes wd-chase {
  0% { opacity: 1; fill: #FFE08A; }
  50% { opacity: 0.25; fill: #FFB020; }
}

@keyframes wd-flash {
  0% { opacity: 1; fill: #F4F0FF; }
  50% { opacity: 0.3; }
}

@keyframes wd-glow {
  50% { stroke-width: 5; }
}

@media (prefers-reduced-motion: reduce) {
  .wd--spinning .wd__bulb, .wd--landed .wd__bulb, .wd__win { animation: none; }
  .wd__pointer { transition: none; }
}
</style>
