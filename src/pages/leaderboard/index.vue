<template>
  <div class="dash">
    <AppNav />

    <main class="dash-body">
      <div class="lb-head">
        <div>
          <h1 class="lb-title">Leaderboard</h1>
          <p class="lb-subtitle">The most dedicated keyholders and wearers on ChastHub.</p>
        </div>

        <div v-if="authStore.isAuthenticated" class="lb-visibility">
          <div class="lb-visibility__text">
            <span class="lb-visibility__label">Show me here</span>
            <span class="lb-visibility__hint">{{ optSaving ? 'Saving…' : (optOut ? 'Hidden' : 'Visible') }}</span>
          </div>
          <button
            class="toggle"
            :class="{ 'toggle--on': !optOut }"
            :disabled="optSaving"
            @click="handleOptOut"
          >
            <span class="toggle__knob" />
          </button>
        </div>
      </div>

      <!-- Switcher -->
      <div class="lb-switch">
        <button
          class="lb-switch__tab lb-switch__tab--loqholders"
          :class="{ 'lb-switch__tab--active': activeTab === 'loqholders' }"
          @click="switchTab('loqholders')"
        >
          Top Keyholders
        </button>
        <button
          class="lb-switch__tab lb-switch__tab--loqees"
          :class="{ 'lb-switch__tab--active': activeTab === 'loqees' }"
          @click="switchTab('loqees')"
        >
          Top Wearers
        </button>
        <div
          class="lb-switch__indicator"
          :class="activeTab === 'loqees' ? 'lb-switch__indicator--loqees' : 'lb-switch__indicator--loqholders'"
        />
      </div>

      <!-- Board -->
      <LeaderboardTable
        v-if="activeTab === 'loqholders'"
        :rows="loqholders"
        :own-rank="ownLoqholderRank"
        :loading="loading"
        :error="error"
        type="loqholders"
        @retry="fetchLoqholders()"
      />
      <LeaderboardTable
        v-else
        :rows="loqees"
        :own-rank="ownLoqeeRank"
        :loading="loading"
        :error="error"
        type="loqees"
        @retry="fetchLoqees()"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const { authFetch } = useAuthFetch()
const {
  loqholders, loqees, loading, error, fetchLoqholders, fetchLoqees,
  ownLoqholderRank, ownLoqeeRank, fetchOwnLoqholderRank, fetchOwnLoqeeRank,
} = useLeaderboard()

// TASK-111 — this page had no title and no description at all.
//
// TASK-119 — and it is noindex now. The rows load in onMounted, so the served
// HTML only ever showed the empty state; publishing the real board instead
// would make pseudonymous display names searchable in Google. The robots
// header is set in routeRules too — this meta tag is the belt to that braces,
// since a crawler that reaches the page by some other route still sees it.
useSeoMeta({
  robots: 'noindex, follow',
  title: 'Leaderboard',
  description: 'The ChastHub leaderboard: which keyholders hold the most keys, and who has spent the longest in chastity. Standings update as locks run.',
  ogTitle: 'ChastHub Leaderboard',
  ogDescription: 'Who is holding the most keys, and who has spent the longest locked.',
})

const activeTab = ref<'loqholders' | 'loqees'>('loqholders')
const optOut = ref(authStore.profile?.leaderboard_opt_out ?? false)
const optSaving = ref(false)

onMounted(() => {
  fetchLoqholders()
  if (authStore.isAuthenticated) fetchOwnLoqholderRank(authFetch)
})

function switchTab(tab: 'loqholders' | 'loqees') {
  if (activeTab.value === tab) return
  activeTab.value = tab
  if (tab === 'loqholders' && loqholders.value.length === 0) fetchLoqholders()
  if (tab === 'loqees' && loqees.value.length === 0) fetchLoqees()
  if (authStore.isAuthenticated) {
    if (tab === 'loqholders' && !ownLoqholderRank.value) fetchOwnLoqholderRank(authFetch)
    if (tab === 'loqees' && !ownLoqeeRank.value) fetchOwnLoqeeRank(authFetch)
  }
}

async function handleOptOut() {
  optOut.value = !optOut.value
  optSaving.value = true
  try {
    await authFetch('/api/profile/leaderboard-opt-out', {
      method: 'POST',
      body: { opt_out: optOut.value },
    })
    if (authStore.profile) {
      authStore.setProfile({ ...authStore.profile, leaderboard_opt_out: optOut.value })
    }
  }
  catch {
    optOut.value = !optOut.value // revert on error
  }
  finally {
    optSaving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/shared-ui' as *;

.lb-head {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
}

.lb-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.lb-subtitle {
  color: var(--color-text-muted);
  margin: 0.3rem 0 0;
  font-size: 0.9375rem;
}

// ── Visibility toggle ────────────────────────────────────────────────────────

.lb-visibility {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
  margin-left: auto;

  &__text {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  &__label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text);
  }

  &__hint {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
}


// ── Switcher ─────────────────────────────────────────────────────────────────
// Full-width sliding-underline switch — each tab is an even 50% column, so
// it stays balanced at any viewport width without separate mobile rules.
// Accent tied to role: loqholders green (matches .role-badge--loqholder
// elsewhere in the app), loqees indigo (matches .role-badge--loqee) — ties
// the board's identity back to the same role colors instead of a generic one.

.lb-switch {
  position: relative;
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.lb-switch__tab {
  flex: 1;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  padding: 0.75rem 0;
  text-align: center;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text-muted);
  transition: color 0.2s;

  &:hover { color: var(--color-text); }

  &--loqholders.lb-switch__tab--active { color: #10b981; }
  &--loqees.lb-switch__tab--active { color: var(--color-accent); }
}

.lb-switch__indicator {
  position: absolute;
  left: 0;
  bottom: -1px;
  height: 2px;
  width: 50%;
  transition: transform 0.3s cubic-bezier(0.65, 0, 0.35, 1), background 0.2s;

  &--loqholders {
    background: #10b981;
    transform: translateX(0);
  }

  &--loqees {
    background: var(--color-accent);
    transform: translateX(100%);
  }
}
</style>
