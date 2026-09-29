<script setup lang="ts">
import type { StatsBoardKey, StatsMe } from '~/types'
import { BOARD_META, formatBoardValue } from '~/utils/statsBoards'
import { roleLabel } from '~/utils/profileLabels'

// "Your stats": your best-known place, how far ahead of others you are, and
// how much it takes to climb one spot, then your place on every other board.
const props = defineProps<{ data: StatsMe | null; loading: boolean }>()

const authStore = useAuthStore()

const MAIN: Record<string, StatsBoardKey> = { loqee: 'wearer_longest', loqholder: 'keyholder_locks' }

const main = computed(() => {
  const key = MAIN[props.data?.role ?? '']
  if (!key) return null
  const entry = props.data?.boards[key]
  return entry ? { key, ...entry } : null
})

const others = computed(() => {
  if (!props.data) return []
  const mainKey = main.value?.key
  return (Object.entries(props.data.boards) as [StatsBoardKey, { total: number; me: { rank: number; value: number } | null }][])
    .filter(([k, v]) => k !== mainKey && (k !== 'locktober_survivors' || v.me))
    .map(([k, v]) => ({ key: k, label: BOARD_META[k].label, me: v.me }))
})

const percent = computed(() => {
  const m = main.value
  if (!m?.me || m.total < 2) return null
  return Math.round((m.me.below / (m.total - 1)) * 100)
})

const toNext = computed(() => {
  const m = main.value
  if (!m?.me || m.me.next_value == null) return null
  const diff = Math.max(0, m.me.next_value - m.me.value)
  const meta = BOARD_META[m.key]
  return meta.kind === 'hours'
    ? `${formatBoardValue(m.key, diff || 0.5)} to pass #${m.me.rank - 1}`
    : `${Math.max(1, Math.ceil(diff))} more to pass #${m.me.rank - 1}`
})

const whoWord = computed(() => props.data?.role === 'loqholder' ? 'keyholders' : 'wearers')
const comparative = computed(() => main.value?.key === 'wearer_longest' ? 'Longer than' : 'Ahead of')
</script>

<template>
  <section class="ys">
    <h3 class="ys__title">Your stats</h3>
    <p class="ys__sub">Only you see this card.</p>

    <div class="ys__me">
      <UserAvatar class="ys__avatar" :avatar-url="authStore.profile?.avatar_url" :display-name="authStore.profile?.display_name" />
      <div>
        <strong>{{ authStore.profile?.display_name }}</strong>
        <span class="ys__role">{{ roleLabel(authStore.profile?.role) }}</span>
      </div>
    </div>

    <div v-if="loading" class="ys__state"><div class="spinner spinner--sm" /></div>

    <p v-else-if="data?.hidden" class="ys__note">
      You are hidden from rankings. Turn on "Show me in rankings" above to get a place on the boards.
    </p>

    <template v-else-if="data">
      <div v-if="main" class="ys__big">
        <span class="ys__big-label">{{ BOARD_META[main.key].label }}</span>
        <template v-if="main.me">
          <strong class="ys__big-value">{{ formatBoardValue(main.key, main.me.value) }}</strong>
          <span v-if="percent !== null" class="ys__big-label">{{ comparative }} <b>{{ percent }}%</b> of {{ whoWord }}</span>
          <span class="ys__bar"><i :style="{ width: `${Math.max(4, percent ?? 100)}%` }" /></span>
          <span class="ys__big-foot">
            <span>#{{ main.me.rank }} of {{ main.total }}</span>
            <span>{{ toNext ?? 'You lead this board' }}</span>
          </span>
        </template>
        <p v-else class="ys__note ys__note--tight">No place yet. Your first lock with a keyholder puts you on the board.</p>
      </div>

      <dl class="ys__list">
        <div v-for="o in others" :key="o.key">
          <dt>{{ o.label }}</dt>
          <dd v-if="o.me">#{{ o.me.rank }}<small>{{ formatBoardValue(o.key, o.me.value) }}</small></dd>
          <dd v-else class="ys__none">not ranked</dd>
        </div>
      </dl>
    </template>
  </section>
</template>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;

.ys {
  border-radius: 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 22px;

  &__title { margin: 0; font: 700 18px var(--font-display); }
  &__sub { margin: 4px 0 16px; font-size: 13px; color: var(--color-text-muted); }

  &__me {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 18px;

    strong { display: block; font: 700 17px var(--font-display); }
  }

  &__avatar { width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0; }

  &__role {
    display: inline-block;
    margin-top: 3px;
    padding: 3px 9px;
    border-radius: 999px;
    background: rgba(var(--color-accent-rgb), 0.15);
    color: var(--color-accent);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  &__state { display: flex; justify-content: center; padding: 20px 0; }

  &__note { margin: 0; font-size: 14px; color: var(--color-text-muted); line-height: 1.5; }
  &__note--tight { margin-top: 6px; }

  &__big {
    display: flex;
    flex-direction: column;
    padding: 16px;
    margin-bottom: 14px;
    border-radius: 18px;
    background: linear-gradient(120deg, rgba(var(--color-brand-rgb), 0.16), rgba(var(--color-cta-rgb), 0.1));
    border: 1px solid rgba(var(--color-brand-rgb), 0.35);
  }

  &__big-label { font-size: 13px; color: #E6DAFF; }
  &__big-value { font: 700 34px var(--font-display); margin: 2px 0; font-variant-numeric: tabular-nums; }

  &__bar {
    height: 8px;
    margin: 10px 0 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    overflow: hidden;

    i { display: block; height: 100%; border-radius: 999px; background: var(--gradient-brand); }
  }

  &__big-foot { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--color-text-muted); }

  &__list {
    margin: 0;

    div {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 11px 0;
      border-top: 1px solid var(--color-border);
      font-size: 14px;
    }

    dt { color: #CFC5F2; }

    dd {
      margin: 0;
      font: 700 15px var(--font-display);

      small { margin-left: 6px; color: var(--color-text-muted); font: 500 12px var(--font-sans); }
    }
  }

  &__none { color: var(--color-text-muted); font: 500 13px var(--font-sans) !important; }
}
</style>
