<script setup lang="ts">
import { AVATAR_PRESETS, DEFAULT_AVATAR_URL, presetKeyFromAvatarUrl } from '~/utils/avatarPresets'

const props = withDefaults(defineProps<{
  avatarUrl?: string | null
  displayName?: string | null
}>(), {
  avatarUrl: null,
  displayName: null,
})

const imageUrl = computed(() => {
  const url = (props.avatarUrl ?? '').trim()
  return url.startsWith('https://') ? url : null
})

const preset = computed(() => {
  if (imageUrl.value) return null
  const key = presetKeyFromAvatarUrl((props.avatarUrl ?? '').trim())
  return AVATAR_PRESETS.find(p => p.key === key) ?? null
})

// TASK-151 — the artwork's own neon halo could not survive: it is opaque out
// to the edge of the master, and this element masks its contents to a circle,
// so the halo was being cut off square. Painting it as a box-shadow instead
// puts it back outside the mask, where it stays crisp at 28px in the nav and
// at 56px on the leaderboard podium alike.
const haloStyle = computed(() =>
  preset.value ? { '--avatar-halo': preset.value.color } : undefined
)

const altText = computed(() => props.displayName ? `${props.displayName}'s avatar` : '')
</script>

<template>
  <span class="user-avatar" :class="{ 'user-avatar--preset': preset }" :style="haloStyle">
    <img v-if="imageUrl" :src="imageUrl" :alt="altText" class="user-avatar__img">
    <img
      v-else
      :src="preset ? preset.src : DEFAULT_AVATAR_URL"
      :alt="altText"
      class="user-avatar__img"
      width="256"
      height="256"
      decoding="async"
    >
  </span>
</template>

<style scoped>
.user-avatar {
  overflow: hidden;
}

/* Sized in rem rather than px so the halo keeps its proportions across the
   28px nav avatar and the 56px podium one. Consumers set the dimensions and
   the border-radius; this only adds the glow. */
.user-avatar--preset {
  box-shadow: 0 0 0.3rem color-mix(in srgb, var(--avatar-halo) 55%, transparent);
}

.user-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
