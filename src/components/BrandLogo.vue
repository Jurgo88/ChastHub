<script setup lang="ts">
// The ChastHub mark (timer ring + keyhole) and wordmark, drawn inline so it
// stays crisp at any size and needs no image request.
withDefaults(defineProps<{ size?: number; showMark?: boolean }>(), { size: 22, showMark: true })
const uid = `bl-${String(useId()).replace(/[^a-zA-Z0-9_-]/g, '')}`
</script>

<template>
  <span class="brand-logo" :style="{ fontSize: `${size}px` }">
    <svg v-if="showMark" class="brand-logo__mark" viewBox="0 0 36 36" aria-hidden="true">
      <defs>
        <linearGradient :id="uid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#EB3678" />
          <stop offset="1" stop-color="#FB773C" />
        </linearGradient>
      </defs>
      <circle cx="18" cy="18" r="15" fill="none" stroke="#4F1787" stroke-width="4" />
      <circle cx="18" cy="18" r="15" fill="none" :stroke="`url(#${uid})`" stroke-width="4" stroke-dasharray="78 95" stroke-linecap="round" transform="rotate(-90 18 18)" />
      <circle cx="18" cy="15" r="3.4" :fill="`url(#${uid})`" />
      <path d="M16.2 16.5h3.6l1 6h-5.6z" :fill="`url(#${uid})`" />
    </svg>
    <span class="brand-logo__word">Chast<span class="brand-logo__hub">Hub</span></span>
  </span>
</template>

<style scoped>
.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 0.45em;
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--color-text);
}
.brand-logo__mark { width: 1.45em; height: 1.45em; flex-shrink: 0; }
.brand-logo__hub {
  background: var(--gradient-brand);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
</style>
