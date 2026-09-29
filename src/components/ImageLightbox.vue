<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div
        class="lightbox-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="alt"
        @click.self="$emit('close')"
        @keydown="onKeydown"
      >
        <button type="button" class="lightbox-overlay__close" aria-label="Close" @click="$emit('close')">✕</button>
        <p class="lightbox-overlay__hint">{{ zoomed ? 'Click to zoom out' : 'Click to zoom in' }}</p>
        <div class="lightbox-overlay__scroll" :class="{ 'lightbox-overlay__scroll--zoomed': zoomed }">
          <img
            ref="imgEl"
            :src="src"
            :alt="alt"
            class="lightbox-overlay__img"
            :class="{ 'lightbox-overlay__img--zoomed': zoomed }"
            @click="zoomed = !zoomed"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{ src: string; alt?: string }>()
const emit = defineEmits<{ close: [] }>()

const zoomed = ref(false)
const imgEl = ref<HTMLImageElement | null>(null)
let lastFocused: HTMLElement | null = null

onMounted(() => {
  lastFocused = document.activeElement as HTMLElement | null
  nextTick(() => imgEl.value?.focus())
})

onUnmounted(() => {
  lastFocused?.focus?.()
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}
</script>

<style scoped lang="scss">
.lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;

  &__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 1.125rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s;

    &:hover { background: var(--color-border); }
    &:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  }

  &__hint {
    position: absolute;
    top: 1.25rem;
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
    pointer-events: none;
  }

  &__scroll {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;

    // Flexbox centering clips the "start" side of overflowing content in
    // most browsers, making half the zoomed image unreachable by scroll —
    // switch to block layout with auto margins instead, which centers
    // without that clipping.
    &--zoomed {
      display: block;
      padding: 1rem;

      .lightbox-overlay__img { display: block; margin: auto; }
    }
  }

  &__img {
    max-width: 90vw;
    max-height: 85vh;
    object-fit: contain;
    border-radius: 0.5rem;
    cursor: zoom-in;
    // Zoomed drops the fit-to-viewport cap so the image renders at its
    // actual pixel size — for a typical phone-camera photo that's well
    // beyond the viewport, so the scroll container (overflow: auto) picks
    // up real scrollbars to pan. A CSS `transform: scale()` here wouldn't
    // work for this — transforms don't affect layout size, so the
    // container would never think there's anything to scroll to.
    &--zoomed {
      max-width: none;
      max-height: none;
      border-radius: 0;
      cursor: zoom-out;
    }
  }
}

.lightbox-enter-active,
.lightbox-leave-active { transition: opacity 0.18s ease; }
.lightbox-enter-from,
.lightbox-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .lightbox-enter-active,
  .lightbox-leave-active,
  .lightbox-overlay__img { transition: none; }
}
</style>
