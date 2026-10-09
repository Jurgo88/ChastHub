<template>
  <section v-if="items.length" class="wtd" aria-labelledby="wtd-title">
    <h2 id="wtd-title" class="wtd__title">Today</h2>
    <ul class="wtd__list">
      <li v-for="item in items" :key="item.key">
        <button type="button" class="wtd__item" @click="emit('go', item.target)">
          <span class="wtd__mark" :class="`wtd__mark--${item.state}`" aria-hidden="true">
            <svg v-if="item.state === 'done'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <span class="wtd__text">
            <span class="wtd__label">{{ item.label }}</span>
            <span class="wtd__meta">{{ STATE[item.state] }} · {{ item.meta }}</span>
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { LockSignals } from '~/types'
import { wearerToday, type TodayTarget } from '~/utils/lockDashboard'

const props = defineProps<{
  signals: Partial<LockSignals> | null
  checkinRequired: boolean
  now: number
}>()
const emit = defineEmits<{ go: [target: TodayTarget] }>()

// Spelled out so the state never rests on the mark's colour alone.
const STATE = { done: 'Done', todo: 'To do', waiting: 'Sent' } as const

const items = computed(() => wearerToday(props.signals, props.checkinRequired, props.now))
</script>

<style scoped lang="scss">
.wtd {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__title { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-muted); }
  &__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }

  &__item {
    width: 100%;
    min-height: 48px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 8px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--color-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    &:hover { background: rgba(var(--color-accent-rgb), 0.06); }
    &:focus-visible { outline: 2px solid var(--color-accent); }
  }

  &__mark {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    box-sizing: border-box;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;

    &--done { background: var(--color-success); color: var(--color-on-accent); }
    &--todo { border: 2px solid var(--color-text-muted); }
    &--waiting { border: 2px dashed var(--color-warn); }
  }

  &__text { display: flex; flex-direction: column; min-width: 0; }
  &__label { font-weight: 500; overflow-wrap: anywhere; }
  &__meta { font-size: 12px; color: var(--color-text-muted); }
}
</style>
