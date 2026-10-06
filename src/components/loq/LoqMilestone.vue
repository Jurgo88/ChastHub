<template>
  <Transition name="ms">
    <section v-if="milestone" class="ms" role="status" aria-live="polite">
      <span class="ms__spark ms__spark--1" aria-hidden="true">✦</span>
      <span class="ms__spark ms__spark--2" aria-hidden="true">✧</span>
      <span class="ms__spark ms__spark--3" aria-hidden="true">✦</span>
      <p class="ms__label">Milestone</p>
      <p class="ms__big">{{ milestone.title }}</p>
      <p class="ms__text">{{ milestone.text }}</p>
      <button type="button" class="ms__close" @click="dismiss">Nice</button>
    </section>
  </Transition>
</template>

<script setup lang="ts">
const props = defineProps<{ loqId: string }>()

interface Milestone { key: string; title: string; text: string }

const { authFetch } = useAuthFetch()
const milestone = ref<Milestone | null>(null)

async function load() {
  try {
    milestone.value = (await authFetch<{ milestone: Milestone | null }>(`/api/loqs/${props.loqId}/milestones`)).milestone
  }
  catch {
    // Decoration only: without the table or the network the card just stays away.
    milestone.value = null
  }
}

async function dismiss() {
  milestone.value = null
  await authFetch(`/api/loqs/${props.loqId}/milestones/seen`, { method: 'POST' }).catch(() => {})
}

onMounted(load)
</script>

<style scoped lang="scss">
.ms {
  position: relative;
  overflow: hidden;
  margin-bottom: 14px;
  padding: 22px 18px;
  border-radius: 20px;
  text-align: center;
  background: linear-gradient(135deg, rgba(235, 54, 120, 0.28), rgba(251, 119, 60, 0.22)), rgba(24, 1, 97, 0.85);
  border: 1px solid var(--color-accent);

  &__label { margin: 0; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-text-muted); }
  &__big { margin: 4px 0; font: 700 40px var(--font-display); letter-spacing: -0.02em; }
  &__text { margin: 0 0 14px; font-size: 14px; color: var(--color-text); }

  &__close {
    padding: 10px 26px;
    border: 0;
    border-radius: 999px;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    font-weight: 700;
    cursor: pointer;
  }

  &__spark {
    position: absolute;
    color: var(--color-accent);
    animation: ms-float 3.2s ease-in-out infinite;
    pointer-events: none;

    &--1 { top: 14px; left: 18%; font-size: 18px; }
    &--2 { top: 40px; right: 16%; font-size: 24px; animation-delay: 0.8s; }
    &--3 { bottom: 20px; left: 28%; font-size: 14px; animation-delay: 1.6s; }
  }
}

@keyframes ms-float {
  0%, 100% { transform: translateY(0) scale(1); opacity: 0.5; }
  50% { transform: translateY(-8px) scale(1.25); opacity: 1; }
}

.ms-enter-active, .ms-leave-active { transition: opacity 0.3s, transform 0.3s; }
.ms-enter-from, .ms-leave-to { opacity: 0; transform: translateY(-8px) scale(0.97); }

@media (prefers-reduced-motion: reduce) {
  .ms__spark { animation: none; }
}
</style>
