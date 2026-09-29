<template>
  <div class="lb-table-wrap" :class="`lb-table-wrap--${type}`">

    <div v-if="loading" class="dash-state dash-state--compact">
      <div class="spinner" />
    </div>

    <div v-else-if="error" class="dash-state dash-state--compact">
      <span class="dash-state__icon">⚠️</span>
      <p class="dash-state__title">Couldn't load the leaderboard</p>
      <p class="dash-state__hint">{{ error }}</p>
      <button class="btn btn--ghost" @click="$emit('retry')">Try again</button>
    </div>

    <template v-else-if="rows.length">
      <!-- Podium: top 3 -->
      <div v-if="podium.length" class="podium">
        <div
          v-for="entry in podiumOrder"
          :key="entry.row.id"
          class="podium-card"
          :class="`podium-card--${entry.medal}`"
        >
          <span class="podium-card__medal">{{ entry.emoji }}</span>
          <NuxtLink
            v-if="entry.row.username"
            :to="`/user/${entry.row.username}`"
            class="podium-card__avatar-ring"
          >
            <UserAvatar class="podium-card__avatar" :avatar-url="entry.row.avatar_url" :display-name="entry.row.display_name" />
          </NuxtLink>
          <span v-else class="podium-card__avatar-ring">
            <UserAvatar class="podium-card__avatar" :avatar-url="entry.row.avatar_url" :display-name="entry.row.display_name" />
          </span>
          <span class="podium-card__name">{{ entry.row.display_name }}</span>
          <span class="podium-card__metric">{{ formatMetric(entry.row) }}</span>
        </div>
      </div>

      <!-- Rows 4+ (and/or the pinned own-rank row) -->
      <div v-if="rest.length || showOwnRow" class="lb-card">
        <div class="lb-header">
          <span>#</span>
          <span>Name</span>
          <span class="lb-header__metric">{{ metricLabel }}</span>
        </div>

        <TransitionGroup v-if="rest.length" name="lb-row" tag="div">
          <div v-for="row in rest" :key="row.id" class="lb-row">
            <span class="lb-row__rank">#{{ row.rank }}</span>
            <NuxtLink
              v-if="row.username"
              :to="`/user/${row.username}`"
              class="lb-row__name lb-row__name--link"
            >
              <UserAvatar class="lb-row__avatar" :avatar-url="row.avatar_url" :display-name="row.display_name" />
              <span class="lb-row__name-text">{{ row.display_name }}</span>
            </NuxtLink>
            <span v-else class="lb-row__name">
              <UserAvatar class="lb-row__avatar" :avatar-url="row.avatar_url" :display-name="row.display_name" />
              <span class="lb-row__name-text">{{ row.display_name }}</span>
            </span>
            <span class="lb-row__metric">{{ formatMetric(row) }}</span>
          </div>
        </TransitionGroup>

        <div v-if="showOwnRow" class="lb-own">
          <span class="lb-own__rank">#{{ ownRank!.rank }}</span>
          <span class="lb-own__name">
            <UserAvatar class="lb-own__avatar" :avatar-url="ownRank!.avatar_url" :display-name="ownRank!.display_name" />
            <span class="lb-own__name-text">{{ ownRank!.display_name }}</span>
            <span class="lb-own__you">You</span>
          </span>
          <span class="lb-own__metric">{{ formatMetric(ownRank!) }}</span>
        </div>
      </div>
    </template>

    <div v-else class="dash-state dash-state--compact">
      <span class="dash-state__icon">🏆</span>
      <p class="dash-state__title">No entries yet</p>
      <p class="dash-state__hint">Be the first to make the board.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LeaderboardLoqholder, LeaderboardLoqee } from '~/composables/useLeaderboard'

type Row = (LeaderboardLoqholder | LeaderboardLoqee) & { rank: number; display_name: string; id: string; username: string | null }

const props = defineProps<{
  rows: Row[]
  ownRank: Row | null
  loading: boolean
  error: string
  type: 'loqholders' | 'loqees'
}>()

defineEmits<{ retry: [] }>()

const metricLabel = computed(() => props.type === 'loqholders' ? 'Controlled locks' : 'Longest lock')

const podium = computed(() => props.rows.slice(0, 3))
const rest = computed(() => props.rows.slice(3))

const MEDALS = [
  { medal: 'gold', emoji: '🥇' },
  { medal: 'silver', emoji: '🥈' },
  { medal: 'bronze', emoji: '🥉' },
] as const

// Visual order: silver, gold, bronze — gold sits centered and elevated.
const podiumOrder = computed(() => {
  const withMedals = podium.value.map((row, i) => ({ row, ...MEDALS[i] }))
  const [first, second, third] = withMedals
  return [second, first, third].filter(Boolean) as typeof withMedals
})

// Only show the pinned row if the user actually falls outside the visible
// slice — otherwise they're already in the podium/table above. Guards
// against undefined too, not just null: a "no row" /me response can arrive
// as an empty body (parsed as undefined by ofetch) rather than JSON null.
const showOwnRow = computed(() =>
  !!props.ownRank && props.ownRank.rank > props.rows.length,
)

function formatMetric(row: Row): string {
  if (props.type === 'loqholders') {
    const n = (row as LeaderboardLoqholder).controlled_loqs
    return `${n} ${n === 1 ? 'loq' : 'loqs'}`
  }
  const h = (row as LeaderboardLoqee).longest_loq_hours
  if (h >= 24) {
    const d = Math.floor(h / 24)
    const rem = Math.round(h % 24)
    return rem > 0 ? `${d}d ${rem}h` : `${d}d`
  }
  return `${h}h`
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;

.lb-table-wrap {
  width: 100%;

  &--loqholders { --tab-accent: #10b981; }
  &--loqees { --tab-accent: var(--color-accent); }
}

.dash-state--compact {
  padding: 2rem 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-weight: 600;
  border: none;
  cursor: pointer;

  &--ghost {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text);
    &:hover { background: var(--color-border); }
  }
}

// ── Podium ───────────────────────────────────────────────────────────────────

.podium {
  display: grid;
  grid-template-columns: 1fr 1.15fr 1fr;
  align-items: end;
  gap: 0.75rem;
  margin-bottom: 1.25rem;

  @media (max-width: 560px) {
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
}

.podium-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  padding: 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  min-width: 0;

  &--gold {
    padding-top: 1.5rem;
    border-color: rgba(255, 213, 74, 0.35);
    box-shadow: 0 8px 24px -14px rgba(255, 213, 74, 0.35);

    @media (max-width: 560px) {
      grid-column: 1 / -1;
      order: -1;
    }
  }

  &__medal {
    font-size: 1.375rem;
    position: absolute;
    top: -14px;
    left: 50%;
    transform: translateX(-50%);
  }

  &__avatar-ring {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    padding: 2.5px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #c7cdd6, #8a919c);

    .podium-card--gold & {
      width: 68px;
      height: 68px;
      background: linear-gradient(135deg, #ffd54a, #c9971f);
    }

    .podium-card--bronze & {
      background: linear-gradient(135deg, #d98c4a, #9a5a26);
    }
  }

  &__avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
  }

  &__name {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--color-text);
    margin-top: 0.75rem;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    .podium-card--gold & {
      font-size: 0.9375rem;
    }
  }

  &__metric {
    font-size: 1.0625rem;
    font-weight: 800;
    color: var(--tab-accent);
    margin-top: 0.25rem;
    font-variant-numeric: tabular-nums;

    .podium-card--gold & {
      font-size: 1.3125rem;
    }
  }
}

// ── Table ────────────────────────────────────────────────────────────────────

.lb-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  overflow: hidden;
}

.lb-header {
  display: grid;
  grid-template-columns: 2.75rem 1fr auto;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted, #888);
  border-bottom: 1px solid var(--color-border);

  &__metric {
    text-align: right;
  }
}

.lb-row {
  display: grid;
  grid-template-columns: 2.75rem 1fr auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--color-border);
  transition: background 0.15s;

  &:hover { background: rgba(255, 255, 255, 0.03); }
  &:last-child { border-bottom: none; }

  &__rank {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--color-text-muted, #888);
    font-variant-numeric: tabular-nums;
  }

  &__name {
    font-weight: 600;
    font-size: 0.9375rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    color: var(--color-text);

    &--link {
      text-decoration: none;
      transition: opacity 0.12s;
      &:hover { opacity: 0.75; }
    }
  }

  &__name-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__metric {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--tab-accent);
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
}

.lb-row__avatar {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  flex-shrink: 0;
}

// ── Pinned own-rank row ──────────────────────────────────────────────────────

.lb-own {
  display: grid;
  grid-template-columns: 2.75rem 1fr auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem 1rem;
  background: color-mix(in srgb, var(--tab-accent) 8%, transparent);
  border-top: 1px dashed var(--tab-accent);

  &__rank {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--tab-accent);
    font-variant-numeric: tabular-nums;
  }

  &__name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  &__name-text {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__you {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--tab-accent);
    background: color-mix(in srgb, var(--tab-accent) 16%, transparent);
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    flex-shrink: 0;
  }

  &__metric {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--tab-accent);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
}

.lb-own__avatar {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1.5px solid var(--tab-accent);
}

// Transition
.lb-row-enter-active,
.lb-row-leave-active { transition: opacity 0.2s; }
.lb-row-enter-from,
.lb-row-leave-to { opacity: 0; }
</style>
