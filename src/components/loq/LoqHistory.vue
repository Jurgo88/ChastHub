<template>
  <details class="hist" @toggle="onToggle">
    <summary class="hist__sum">History</summary>

    <div class="hist__body">
      <div class="hist__filters" role="group" aria-label="Filter history">
        <button
          v-for="f in FILTERS"
          :key="f.value"
          type="button"
          class="hist__chip"
          :class="{ 'hist__chip--on': filter === f.value }"
          :aria-pressed="filter === f.value"
          @click="setFilter(f.value)"
        >{{ f.label }}</button>
      </div>

      <p v-if="loading" class="hist__note">Loading…</p>
      <p v-else-if="error" class="hist__note hist__note--err">{{ error }}</p>
      <p v-else-if="!events.length" class="hist__note">Nothing here yet.</p>

      <ol v-else class="hist__list">
        <li v-for="(e, i) in events" :key="`${e.type}-${e.at}-${i}`" class="hist__item">
          <span class="hist__icon" aria-hidden="true">{{ describe(e).icon }}</span>
          <div class="hist__text">
            <span>{{ describe(e).text }}</span>
            <time :datetime="e.at" :title="new Date(e.at).toLocaleString()">{{ whenLabel(e.at) }}</time>
          </div>
        </li>
      </ol>
    </div>
  </details>
</template>

<script setup lang="ts">
import { describeEvent, whenLabel, type HistoryEventView } from '~/utils/lockHistory'

const props = defineProps<{ loqId: string }>()

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'time', label: 'Time changes' },
  { value: 'pauses', label: 'Pauses' },
  { value: 'visitors', label: 'Visitors' },
] as const
type Filter = typeof FILTERS[number]['value']

const { authFetch } = useAuthFetch()
const events = ref<HistoryEventView[]>([])
const filter = ref<Filter>('all')
const loading = ref(false)
const error = ref('')
let loadedOnce = false

const describe = describeEvent

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await authFetch<{ events: HistoryEventView[] }>(`/api/loqs/${props.loqId}/history`, { query: { filter: filter.value } })
    events.value = res.events
  }
  catch {
    error.value = 'Could not load the history.'
  }
  finally {
    loading.value = false
  }
}

function onToggle(e: Event) {
  if ((e.target as HTMLDetailsElement).open && !loadedOnce) {
    loadedOnce = true
    load()
  }
}

function setFilter(value: Filter) {
  if (filter.value === value) return
  filter.value = value
  load()
}
</script>

<style scoped lang="scss">
.hist {
  margin-top: 12px;
  border-top: 1px solid var(--color-border);
  padding-top: 10px;

  &__sum {
    cursor: pointer;
    font: 700 14px var(--font-display);
    color: var(--color-text-muted);
    list-style: none;
    padding: 6px 0;

    &::-webkit-details-marker { display: none; }
    &::before { content: '▸ '; }
  }

  &[open] &__sum::before { content: '▾ '; }

  &__body { padding-top: 6px; }

  &__filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }

  &__chip {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1.5px solid var(--color-border);
    background: transparent;
    color: var(--color-text-muted);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    touch-action: manipulation;

    &--on { border-color: var(--color-accent); color: var(--color-text); background: rgba(var(--color-accent-rgb), 0.14); }
  }

  &__note { margin: 0; font-size: 13px; color: var(--color-text-muted); &--err { color: var(--color-cta); } }

  &__list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }

  &__item { display: flex; align-items: flex-start; gap: 10px; }

  &__icon {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--color-elevated);
    font-size: 14px;
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 14px;
    min-width: 0;

    time { font-size: 12px; color: var(--color-text-muted); }
  }
}
</style>
