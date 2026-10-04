<template>
  <section class="act">
    <div class="act__stats">
      <div><strong>{{ totals.visitors }}</strong><span>{{ totals.visitors === 1 ? 'visitor' : 'visitors' }}</span></div>
      <div><strong class="add">+{{ fmt(totals.added_hours) }}</strong><span>added</span></div>
      <div v-if="permission !== 'add'"><strong class="rem">&minus;{{ fmt(totals.removed_hours) }}</strong><span>taken off</span></div>
    </div>

    <div v-if="reactions" class="act__react" role="group" aria-label="React to this lock">
      <button
        v-for="r in REACTIONS"
        :key="r.key"
        type="button"
        class="rx"
        :class="{ 'rx--on': reacted[r.key] }"
        :disabled="reacted[r.key] || !locked"
        :aria-label="`${r.label}, ${reactions[r.key]}`"
        @click="$emit('react', r.key)"
      >
        <span class="rx__e">{{ r.emoji }}</span>
        <span class="rx__n">{{ reactions[r.key] }}</span>
      </button>
    </div>
    <p v-if="reactError" class="act__err">{{ reactError }}</p>

    <div class="act__top">
      <h2>Top teasers</h2>
      <ol v-if="top.length">
        <li v-for="(p, i) in top" :key="p.name">
          <span class="rank" :class="{ 'rank--1': i === 0 }">{{ i + 1 }}</span>
          <UserAvatar class="av" :avatar-url="p.avatar_url" :display-name="p.name" />
          <span class="name">{{ p.name }}</span>
          <span class="hrs">+{{ fmt(p.hours) }}</span>
        </li>
      </ol>
      <p v-else class="act__empty">Nobody signed in has added time yet. The first spot is yours.</p>
      <p class="act__note">Signed in? Your name shows up here when you add time, unless you hide from rankings.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PublicLoqActivity, ReactionKey } from '~/composables/usePublicLoq'

defineProps<{
  totals: PublicLoqActivity['totals']
  top: PublicLoqActivity['top']
  reactions: PublicLoqActivity['reactions']
  reacted: Partial<Record<ReactionKey, boolean>>
  reactError: string
  permission: 'add' | 'remove' | 'both'
  locked: boolean
}>()
defineEmits<{ react: [ReactionKey] }>()

const REACTIONS: { key: ReactionKey; emoji: string; label: string }[] = [
  { key: 'devil', emoji: '😈', label: 'Devilish' },
  { key: 'lock', emoji: '🔒', label: 'Keep it locked' },
  { key: 'laugh', emoji: '😂', label: 'Funny' },
  { key: 'fire', emoji: '🔥', label: 'Hot' },
]

function fmt(h: number) {
  if (h >= 48) return `${Math.round(h / 24)}d`
  return `${Math.round(h * 10) / 10}h`
}
</script>

<style scoped lang="scss">
.act {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;

  &__stats {
    display: flex;
    justify-content: center;
    gap: 10px;

    div {
      flex: 1;
      max-width: 130px;
      padding: 12px 8px;
      border-radius: 16px;
      background: rgba(24, 1, 97, 0.7);
      border: 1px solid var(--color-border);
      text-align: center;
    }

    strong { display: block; font: 700 22px var(--font-display); font-variant-numeric: tabular-nums; }
    .add { color: var(--color-accent); }
    .rem { color: var(--color-cta); }
    span { font-size: 11px; color: var(--color-text-muted); letter-spacing: 0.08em; text-transform: uppercase; }
  }

  &__react { display: flex; justify-content: center; gap: 8px; }
  &__err { margin: -4px 0 0; text-align: center; font-size: 12px; color: var(--color-text-muted); }

  &__top {
    padding: 16px;
    border-radius: 20px;
    background: rgba(24, 1, 97, 0.8);
    border: 1px solid var(--color-border);

    h2 { margin: 0 0 10px; font: 700 16px var(--font-display); }

    ol { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }

    li { display: flex; align-items: center; gap: 10px; font-size: 14px; }
  }

  &__empty { margin: 0; font-size: 14px; color: var(--color-text-muted); }
  &__note { margin: 12px 0 0; font-size: 12px; line-height: 1.45; color: var(--color-text-muted); }
}

.rank {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--color-elevated);
  font: 700 12px var(--font-display);

  &--1 { background: var(--gradient-brand); color: var(--color-on-accent); }
}

.av { display: block; width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; }
.name { flex: 1; min-width: 0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hrs { font: 700 15px var(--font-display); color: var(--color-accent); font-variant-numeric: tabular-nums; }

.rx {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1.5px solid var(--color-border);
  background: rgba(24, 1, 97, 0.7);
  color: var(--color-text);
  cursor: pointer;
  touch-action: manipulation;
  transition: transform 0.1s, border-color 0.15s;

  &:hover:not(:disabled) { border-color: var(--color-accent); }
  &:active:not(:disabled) { transform: scale(0.94); }
  &:disabled { cursor: default; }

  &--on { border-color: var(--color-accent); background: rgba(var(--color-accent-rgb), 0.16); }

  &__e { font-size: 18px; line-height: 1; }
  &__n { font: 700 14px var(--font-display); font-variant-numeric: tabular-nums; }
}
</style>
