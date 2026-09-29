<script setup lang="ts">
import type { Gender, ProfileStats, UserRole } from '~/types'
import { formatHours, genderLabel, memberSinceLabel, roleLabel } from '~/utils/profileLabels'

// The header shared by /profile (your own) and /user/[username] (someone
// else's): cover, avatar, name line and the stat row. Actions and extras
// come in through slots so each page decides what the visitor can do.
const props = defineProps<{
  displayName: string | null
  username: string | null
  avatarUrl: string | null
  role: UserRole | undefined
  age?: number | null
  gender?: Gender | null
  createdAt?: string | null
  stats: ProfileStats | null
  /** Your own profile: stat wording addresses you ("in your hands"). */
  self?: boolean
}>()

interface Tile { value: string; label: string; highlight?: boolean }

const tiles = computed<Tile[]>(() => {
  const s = props.stats
  if (!s) return []
  const rank = s.rank ? `#${s.rank}` : '–'
  if (s.role === 'loqholder') {
    return [
      { value: String(s.holding_now), label: 'Holding now', highlight: true },
      { value: String(s.locks_completed), label: 'Locks held' },
      { value: formatHours(s.total_hours), label: props.self ? 'Time in your hands' : 'Time controlled' },
      { value: rank, label: 'Stats rank' },
    ]
  }
  return [
    { value: formatHours(s.total_hours), label: 'Total locked', highlight: true },
    { value: formatHours(s.longest_hours), label: 'Longest lock' },
    { value: String(s.locks_completed), label: 'Locks completed' },
    { value: rank, label: 'Stats rank' },
  ]
})

const facts = computed(() => [
  props.age ? String(props.age) : '',
  genderLabel(props.gender),
  props.createdAt ? `Member since ${memberSinceLabel(props.createdAt)}` : '',
].filter(Boolean))
</script>

<template>
  <section class="hero">
    <div class="hero__cover" aria-hidden="true" />

    <div class="hero__body">
      <div class="hero__avatar-wrap">
        <UserAvatar class="hero__avatar" :avatar-url="avatarUrl" :display-name="displayName" />
        <slot name="avatar" />
      </div>

      <div class="hero__id">
        <h1 class="hero__name">{{ displayName || username || 'ChastHub user' }}</h1>
        <div class="hero__line">
          <span v-if="username">@{{ username }}</span>
          <span v-if="role" class="hero__role" :class="`hero__role--${role}`">{{ roleLabel(role) }}</span>
          <span v-for="fact in facts" :key="fact" class="hero__fact">{{ fact }}</span>
        </div>
        <slot name="status" />
      </div>

      <div class="hero__actions">
        <slot name="actions" />
      </div>
    </div>

    <dl v-if="tiles.length" class="hero__stats">
      <div v-for="t in tiles" :key="t.label" class="hero__stat" :class="{ 'hero__stat--hi': t.highlight }">
        <dt class="hero__stat-label">{{ t.label }}</dt>
        <dd class="hero__stat-value">{{ t.value }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped lang="scss">
.hero {
  position: relative;
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-surface);

  &__cover {
    height: 150px;
    background:
      radial-gradient(500px 200px at 85% 20%, rgba(var(--color-cta-rgb), 0.55), transparent 70%),
      radial-gradient(600px 240px at 15% 90%, rgba(var(--color-brand-rgb), 0.6), transparent 70%),
      linear-gradient(120deg, var(--color-elevated), var(--color-surface));
  }

  &__body {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    padding: 0 28px 24px;
    margin-top: -56px;
    flex-wrap: wrap;
  }

  &__avatar-wrap {
    position: relative;
    flex-shrink: 0;
  }

  &__avatar {
    width: 124px;
    height: 124px;
    border-radius: 50%;
    border: 5px solid var(--color-surface);
    display: block;
    background: var(--color-surface);
  }

  &__id {
    flex: 1;
    min-width: 220px;
    // Starts below the cover: only the avatar overlaps it.
    padding-top: 70px;
  }

  &__name {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(26px, 4vw, 34px);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.1;
    overflow-wrap: anywhere;
  }

  &__line {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 8px;
    color: var(--color-text-muted);
    font-size: 14px;
  }

  &__role {
    padding: 4px 11px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;

    &--loqholder { background: rgba(var(--color-cta-rgb), 0.15); color: var(--color-cta); }
    &--loqee { background: rgba(var(--color-accent-rgb), 0.15); color: var(--color-accent); }
    &--admin { background: var(--color-elevated); color: var(--color-text); }
  }

  &__fact {
    display: inline-flex;
    align-items: center;
    gap: 10px;

    &::before {
      content: '';
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--color-elevated);
    }
  }

  &__actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    padding-top: 74px;

    &:empty { display: none; }
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-top: 1px solid var(--color-border);
    margin: 0;
  }

  &__stat {
    display: flex;
    flex-direction: column-reverse;
    gap: 4px;
    padding: 18px 28px;
    border-right: 1px solid var(--color-border);

    &:last-child { border-right: 0; }
  }

  &__stat-value {
    margin: 0;
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  &__stat--hi &__stat-value {
    background: var(--gradient-brand);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  &__stat-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-text-muted);
  }
}

@media (max-width: 700px) {
  .hero {
    border-radius: 22px;

    &__cover { height: 96px; }

    &__body {
      padding: 0 18px 18px;
      margin-top: -46px;
      gap: 12px;
      flex-direction: column;
      align-items: flex-start;
    }

    &__avatar { width: 92px; height: 92px; border-width: 4px; }

    &__id { min-width: 0; padding-top: 0; }

    &__actions { padding-top: 0; }

    &__stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }

    &__stat {
      padding: 14px 18px;
      border-bottom: 1px solid var(--color-border);

      &:nth-child(2n) { border-right: 0; }
      &:nth-last-child(-n + 2) { border-bottom: 0; }
    }

    &__stat-value { font-size: 22px; }
  }
}
</style>
