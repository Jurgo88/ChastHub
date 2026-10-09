<template>
  <section v-if="next" class="wnu" aria-labelledby="wnu-title">
    <div class="wnu__top">
      <span class="wnu__kicker">Next up</span>
      <span v-if="dueText" class="wnu__due" :class="{ 'wnu__due--late': late }">{{ dueText }}</span>
    </div>
    <h2 id="wnu-title" class="wnu__title">{{ next.title }}</h2>
    <p v-if="next.code" class="wnu__detail">
      Write <strong class="wnu__code">{{ next.code }}</strong> on paper and take a photo of yourself with it.
    </p>
    <p v-else class="wnu__detail">{{ next.detail }}</p>
    <button type="button" class="wnu__btn" @click="emit('go', next.target)">{{ next.action }}</button>
  </section>
</template>

<script setup lang="ts">
import type { LockSignals } from '~/types'
import { wearerNextUp, type TodayTarget } from '~/utils/lockDashboard'
import { spanMinutes } from '~/utils/lockHistory'

const props = defineProps<{
  signals: Partial<LockSignals> | null
  checkinRequired: boolean
  now: number
}>()
const emit = defineEmits<{ go: [target: TodayTarget] }>()

const next = computed(() => wearerNextUp(props.signals, props.checkinRequired))
const msLeft = computed(() => (next.value?.due_at ? new Date(next.value.due_at).getTime() - props.now : null))
const late = computed(() => msLeft.value !== null && msLeft.value <= 0)
const dueText = computed(() => {
  if (msLeft.value === null) return ''
  return late.value ? 'Deadline passed' : `Due in ${spanMinutes(Math.max(1, Math.ceil(msLeft.value / 60_000)))}`
})
</script>

<style scoped lang="scss">
.wnu {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border-radius: 20px;
  background: var(--color-elevated);

  &__top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  &__kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text); }
  &__due { font-size: 13px; font-weight: 600; color: var(--color-warn); }
  &__due--late { color: var(--color-accent); }
  &__title { margin: 0; font-family: var(--font-display); font-size: 22px; font-weight: 600; color: var(--color-text); overflow-wrap: anywhere; }
  &__detail { margin: 0; font-size: 14px; line-height: 1.5; color: var(--color-text); }
  &__code { font-family: var(--font-mono); font-size: 17px; letter-spacing: 0.08em; }

  &__btn {
    min-height: 48px;
    border: 0;
    border-radius: 14px;
    background: var(--color-cta);
    color: var(--color-on-accent);
    font: 700 16px var(--font-sans);
    cursor: pointer;
    &:hover { filter: brightness(1.06); }
    &:focus-visible { outline: 2px solid var(--color-text); outline-offset: 2px; }
  }
}
</style>
