<template>
  <div class="wd" :style="{ '--spin-ms': `${spinMs}ms` }">
    <svg viewBox="-110 -110 220 220" class="wd__svg" role="img" :aria-label="`Wheel with ${segments.length} segments`">
      <g class="wd__disc" :style="{ transform: `rotate(${rotation}deg)` }">
        <g v-for="(s, i) in slices" :key="i">
          <path :d="s.path" :fill="s.color" stroke="rgba(14,0,51,0.9)" stroke-width="1.5" />
          <text
            :transform="`rotate(${s.mid}) translate(0 -62)`"
            class="wd__label"
            text-anchor="middle"
            dominant-baseline="middle"
          >{{ s.label }}</text>
        </g>
        <circle r="14" fill="#0E0033" stroke="rgba(255,255,255,0.25)" stroke-width="2" />
      </g>
      <path d="M-9 -112 L9 -112 L0 -92 Z" fill="#F4F0FF" stroke="#0E0033" stroke-width="2" stroke-linejoin="round" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { segmentArcs, segmentLabel, type WheelSegment, type WheelSegmentType } from '~/utils/wheel'

const props = withDefaults(defineProps<{
  segments: WheelSegment[]
  /** Degrees the disc is turned by; the parent animates by raising it. */
  rotation?: number
  spinMs?: number
}>(), { rotation: 0, spinMs: 3800 })

const COLORS: Record<WheelSegmentType, string> = {
  add: '#EB3678',
  remove: '#2E9E78',
  freeze: '#3C7DE0',
  task: '#FB773C',
  nothing: '#5B4A9E',
}
const R = 100

function point(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180
  return `${(r * Math.sin(rad)).toFixed(2)} ${(-r * Math.cos(rad)).toFixed(2)}`
}

const slices = computed(() => {
  const arcs = segmentArcs(props.segments)
  return props.segments.map((s, i) => {
    const { start, end, mid } = arcs[i]!
    const large = end - start > 180 ? 1 : 0
    // A single full circle cannot be drawn as one arc, but a wheel always has 4+ segments.
    const path = `M0 0 L${point(start, R)} A${R} ${R} 0 ${large} 1 ${point(end, R)} Z`
    const label = segmentLabel(s)
    return { path, mid, color: COLORS[s.type], label: label.length > 12 ? `${label.slice(0, 11)}…` : label }
  })
})
</script>

<style scoped lang="scss">
.wd {
  width: 100%;
  max-width: 280px;
  margin: 0 auto;

  &__svg { display: block; width: 100%; height: auto; overflow: visible; }

  &__disc {
    transform-origin: 0 0;
    transition: transform var(--spin-ms) cubic-bezier(0.12, 0.7, 0.1, 1);
  }

  &__label { font: 700 9px var(--font-display); fill: #fff; pointer-events: none; }
}

@media (prefers-reduced-motion: reduce) {
  .wd__disc { transition-duration: 0.01ms; }
}
</style>
