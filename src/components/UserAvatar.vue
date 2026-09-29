<script setup lang="ts">
// A profile photo when there is one, otherwise the first letter of the display
// name on a brand gradient. The letter is SVG text, so it scales with whatever
// size the consumer gives the element (28px in the nav, 124px on the profile)
// without a font-size per call site. The gradient is picked from the name, so
// the same person always gets the same colours.
const props = withDefaults(defineProps<{
  avatarUrl?: string | null
  displayName?: string | null
}>(), {
  avatarUrl: null,
  displayName: null,
})

const GRADIENTS: [string, string][] = [
  ['#EB3678', '#FB773C'],
  ['#4F1787', '#F25A93'],
  ['#EB3678', '#4F1787'],
  ['#FB773C', '#F25A93'],
  ['#34138A', '#EB3678'],
]

const imageUrl = computed(() => {
  const url = (props.avatarUrl ?? '').trim()
  return url.startsWith('https://') ? url : null
})

const initial = computed(() => {
  const name = (props.displayName ?? '').trim()
  const first = name ? Array.from(name)[0]! : '?'
  return first.toUpperCase()
})

const colors = computed(() => {
  const name = props.displayName ?? ''
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0
  return GRADIENTS[hash % GRADIENTS.length]!
})

const gradientId = `ua-${String(useId()).replace(/[^a-zA-Z0-9_-]/g, '')}`
const altText = computed(() => props.displayName ? `${props.displayName}'s avatar` : '')
</script>

<template>
  <span class="user-avatar">
    <img v-if="imageUrl" :src="imageUrl" :alt="altText" class="user-avatar__img">
    <svg v-else class="user-avatar__img" viewBox="0 0 100 100" role="img" :aria-label="altText">
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" :stop-color="colors[0]" />
          <stop offset="1" :stop-color="colors[1]" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" :fill="`url(#${gradientId})`" />
      <text
        x="50"
        y="50"
        dy="0.35em"
        text-anchor="middle"
        class="user-avatar__letter"
      >{{ initial }}</text>
    </svg>
  </span>
</template>

<style scoped>
.user-avatar {
  overflow: hidden;
}

.user-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.user-avatar__letter {
  font-family: var(--font-display);
  font-size: 46px;
  font-weight: 700;
  fill: #0E0033;
}
</style>
