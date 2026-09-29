<script setup lang="ts">
import type { StatsBoardKey, StatsMeRow, StatsRow } from '~/types'
import { BOARD_META, formatBoardValue } from '~/utils/statsBoards'

// One ranking: the leader in a wide row, everyone else with a bar sized
// against the leader, and your own row pinned at the bottom when you are
// further down than the list goes.
const props = defineProps<{
  board: StatsBoardKey
  rows: StatsRow[]
  me: StatsMeRow | null
  loading: boolean
  error: string
}>()
defineEmits<{ retry: [] }>()

const NuxtLink = resolveComponent('NuxtLink')

const meta = computed(() => BOARD_META[props.board])
const leader = computed(() => props.rows[0] ?? null)
const rest = computed(() => props.rows.slice(1))
const top = computed(() => Math.max(leader.value?.value ?? 0, 0.0001))
const showMe = computed(() => !!props.me && !props.rows.some(r => r.id === props.me!.id))

function barWidth(v: number) {
  return `${Math.max(3, Math.min(100, (v / top.value) * 100))}%`
}

function sinceLabel(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const EMPTY: Record<StatsBoardKey, string> = {
  wearer_longest: 'No finished locks with a keyholder yet.',
  wearer_total: 'Nobody has logged time here yet.',
  wearer_completed: 'No locks completed in this period yet.',
  wearer_running: 'Nobody is locked with a keyholder right now.',
  keyholder_locks: 'No keyholder has taken a lock yet.',
  keyholder_hours: 'No keyholder time logged yet.',
  keyholder_wearers: 'No keyholder has taken a lock yet.',
  keyholder_holding: 'No keyholder is holding a lock right now.',
  crowd: 'Visitors have not added time to a Key Drop lock yet.',
  locktober_survivors: 'Nobody has made it through Locktober so far.',
}
</script>

<template>
  <section class="sboard">
    <slot name="bar" />

    <div v-if="loading" class="sboard__state"><div class="spinner spinner--sm" /></div>

    <div v-else-if="error" class="sboard__state">
      <p>{{ error }}</p>
      <button class="pbtn pbtn--sm" type="button" @click="$emit('retry')">Try again</button>
    </div>

    <div v-else-if="!leader" class="sboard__state">
      <p>{{ EMPTY[board] }}</p>
    </div>

    <template v-else>
      <component :is="leader.username ? NuxtLink : 'div'" :to="leader.username ? `/user/${leader.username}` : undefined" class="lead" :class="{ 'lead--me': me?.id === leader.id }">
        <span class="lead__rank">1</span>
        <UserAvatar class="lead__avatar" :avatar-url="leader.avatar_url" :display-name="leader.display_name" />
        <span class="lead__name">
          <strong>{{ leader.display_name }}<span v-if="me?.id === leader.id" class="you">YOU</span></strong>
          <span>
            <template v-if="leader.self_lock">Self-lock · </template>
            <template v-if="leader.since">since {{ sinceLabel(leader.since) }}</template>
            <template v-else>{{ meta.label }}</template>
          </span>
        </span>
        <span class="lead__value">
          <strong>{{ formatBoardValue(board, leader.value) }}</strong>
          <span>{{ meta.unit }}</span>
        </span>
      </component>

      <component
        :is="row.username ? NuxtLink : 'div'"
        v-for="row in rest"
        :key="row.id"
        :to="row.username ? `/user/${row.username}` : undefined"
        class="srow"
        :class="{ 'srow--me': me?.id === row.id }"
      >
        <span class="srow__rank">{{ row.rank }}</span>
        <UserAvatar class="srow__avatar" :avatar-url="row.avatar_url" :display-name="row.display_name" />
        <span class="srow__mid">
          <span class="srow__name">
            {{ row.display_name }}
            <span v-if="me?.id === row.id" class="you">YOU</span>
            <span v-if="row.self_lock" class="self">self-lock</span>
          </span>
          <span class="srow__bar"><i :style="{ width: barWidth(row.value) }" /></span>
        </span>
        <span class="srow__value">{{ formatBoardValue(board, row.value) }}</span>
      </component>

      <template v-if="showMe && me">
        <div class="sgap" aria-hidden="true">• • •</div>
        <div class="srow srow--me">
          <span class="srow__rank">{{ me.rank }}</span>
          <UserAvatar class="srow__avatar" :avatar-url="me.avatar_url" :display-name="me.display_name" />
          <span class="srow__mid">
            <span class="srow__name">{{ me.display_name }}<span class="you">YOU</span></span>
            <span class="srow__bar"><i :style="{ width: barWidth(me.value) }" /></span>
          </span>
          <span class="srow__value">{{ formatBoardValue(board, me.value) }}</span>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/profile' as *;

.sboard {
  border-radius: 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  overflow: hidden;

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 48px 20px;
    text-align: center;
    color: var(--color-text-muted);

    p { margin: 0; }
  }
}

.lead {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px 20px;
  background: linear-gradient(90deg, rgba(var(--color-brand-rgb), 0.16), transparent 70%);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  text-decoration: none;

  &:hover { text-decoration: none; background-color: rgba(255, 255, 255, 0.02); }

  &__rank {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    font: 700 15px var(--font-display);
  }

  &__avatar { width: 56px; height: 56px; border-radius: 50%; flex-shrink: 0; }

  &__name {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;

    strong {
      font: 700 20px var(--font-display);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    > span { font-size: 13px; color: var(--color-text-muted); }
  }

  &__value {
    text-align: right;
    flex-shrink: 0;

    strong {
      display: block;
      font: 700 30px var(--font-display);
      font-variant-numeric: tabular-nums;
      background: var(--gradient-brand);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    span { font-size: 12px; color: var(--color-text-muted); }
  }
}

.srow {
  display: grid;
  grid-template-columns: 38px 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(52, 19, 138, 0.6);
  color: var(--color-text);
  text-decoration: none;

  &:last-child { border-bottom: 0; }
  &:hover { text-decoration: none; background: rgba(255, 255, 255, 0.02); }

  &__rank { font: 600 14px var(--font-display); color: var(--color-text-muted); text-align: center; }
  &__avatar { width: 34px; height: 34px; border-radius: 50%; }
  &__mid { min-width: 0; display: flex; flex-direction: column; gap: 7px; }

  &__name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__bar {
    height: 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.07);
    overflow: hidden;

    i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--color-elevated), var(--color-brand)); }
  }

  &__value {
    min-width: 70px;
    text-align: right;
    font: 700 16px var(--font-display);
    font-variant-numeric: tabular-nums;
  }

  &--me {
    background: rgba(var(--color-cta-rgb), 0.1);
    box-shadow: inset 3px 0 0 var(--color-cta);
  }
}

.sgap {
  padding: 8px 20px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 12px;
  letter-spacing: 0.3em;
  border-bottom: 1px solid rgba(52, 19, 138, 0.6);
}

.you {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-cta);
  color: var(--color-on-accent);
  font: 800 10px var(--font-sans);
  letter-spacing: 0.06em;
  vertical-align: 2px;
}

.self {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font: 600 10px var(--font-sans);
  letter-spacing: 0.04em;
  vertical-align: 2px;
}

@media (max-width: 600px) {
  .lead { padding: 16px 14px; gap: 12px; }
  .lead__avatar { width: 44px; height: 44px; }
  .lead__name strong { font-size: 17px; }
  .lead__value strong { font-size: 22px; }
  .srow { grid-template-columns: 26px 30px minmax(0, 1fr) auto; padding: 10px 14px; gap: 9px; }
  .srow__avatar { width: 30px; height: 30px; }
  .srow__value { min-width: 56px; font-size: 15px; }
}
</style>
