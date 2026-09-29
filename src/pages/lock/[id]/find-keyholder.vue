<template>
  <div class="find-page">

    <header class="find-nav">
      <NuxtLink to="/dashboard/wearer" class="find-nav__back">← Back</NuxtLink>
      <h1 class="find-nav__title">Find a Keyholder</h1>
      <span />
    </header>

    <main class="find-main">

      <!-- Search -->
      <div class="find-search">
        <input
          v-model="q"
          type="search"
          class="find-search__input"
          placeholder="Search by name…"
          @input="onSearch"
        />
      </div>

      <!-- Loading -->
      <div v-if="loading && items.length === 0" class="dash-state">
        <div class="spinner" />
      </div>

      <!-- Empty -->
      <div v-else-if="!loading && items.length === 0" class="dash-state">
        <span class="dash-state__icon">🔍</span>
        <p class="dash-state__title">No keyholders found</p>
        <p class="dash-state__hint">Try a different search or browse
          <NuxtLink to="/discover" class="find-link">Discover</NuxtLink>.
        </p>
      </div>

      <!-- List -->
      <ul v-else class="find-list">
        <li
          v-for="lh in items"
          :key="lh.id"
          class="find-card"
          :class="{ 'find-card--selected': selected === lh.id, 'find-card--requested': lh.requested }"
          @click="!lh.requested && select(lh.id)"
        >
          <div class="find-card__avatar">
            <img v-if="lh.avatar_url" :src="lh.avatar_url" :alt="lh.display_name ?? ''" />
            <span v-else class="find-card__avatar-fallback">{{ initials(lh.display_name) }}</span>
          </div>
          <div class="find-card__body">
            <p class="find-card__name">{{ lh.display_name ?? 'Anonymous' }}</p>
            <p v-if="lh.bio" class="find-card__bio">{{ lh.bio }}</p>
            <p class="find-card__meta">
              <span>{{ lh.active_loqs_count }} active lock{{ lh.active_loqs_count === 1 ? '' : 's' }}</span>
              <span v-if="lh.requested" class="find-card__tag find-card__tag--pending">Request pending</span>
            </p>
          </div>
          <div class="find-card__check" aria-hidden="true">
            <span v-if="lh.requested">✓</span>
            <span v-else-if="selected === lh.id">✓</span>
          </div>
        </li>
      </ul>

      <!-- Load more -->
      <div v-if="hasMore" class="find-more">
        <button class="btn btn--ghost" :disabled="loading" @click="loadMore">
          {{ loading ? 'Loading…' : 'Load more' }}
        </button>
      </div>

    </main>

    <!-- Sticky send bar -->
    <footer v-if="selected" class="find-footer">
      <p class="find-footer__count">{{ selectedLoqholder?.display_name ?? 'Keyholder' }} selected</p>
      <button class="btn btn--primary" :disabled="sending" @click="sendRequest">
        {{ sending ? 'Sending…' : 'Send Request' }}
      </button>
    </footer>

    <p v-if="sendError" class="find-error">{{ sendError }}</p>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { authFetch } = useAuthFetch()

const loqId = route.params.id as string

interface LoqholderItem {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  active_loqs_count: number
  requested: boolean
}

const q = ref('')
const items = ref<LoqholderItem[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const sending = ref(false)
const sendError = ref('')
// TASK-057 — one loqholder at a time (single select, not a Set).
const selected = ref<string | null>(null)
const selectedLoqholder = computed(() => items.value.find(i => i.id === selected.value) ?? null)

const LIMIT = 20
const hasMore = computed(() => items.value.length < total.value)

let searchTimer: ReturnType<typeof setTimeout> | null = null

async function fetchPage(reset = false) {
  if (reset) { page.value = 1; items.value = [] }
  loading.value = true
  try {
    const res = await authFetch<{ data: LoqholderItem[]; total: number }>('/api/loqholders/available', {
      params: { q: q.value || undefined, loq_id: loqId, page: page.value, limit: LIMIT },
    })
    if (reset) {
      items.value = res.data
    }
    else {
      items.value = [...items.value, ...res.data]
    }
    total.value = res.total
  }
  catch { /* silently fail on fetch errors */ }
  finally { loading.value = false }
}

function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchPage(true), 300)
}

function loadMore() {
  page.value++
  fetchPage(false)
}

function select(id: string) {
  selected.value = selected.value === id ? null : id
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

async function sendRequest() {
  if (!selected.value) return
  sending.value = true
  sendError.value = ''
  try {
    await authFetch(`/api/loqs/${loqId}/request`, {
      method: 'POST',
      body: { loqholder_id: selected.value },
    })
    await router.push('/dashboard/wearer')
  }
  catch (err: unknown) {
    const e = err as { data?: { message?: string }; message?: string }
    sendError.value = e?.data?.message ?? e?.message ?? 'Failed to send request'
  }
  finally { sending.value = false }
}

onMounted(() => fetchPage(true))
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/shared-ui' as *;

.find-page {
  /* TASK-153 — see .dash in _loq-card.scss: the default layout owns the
     viewport height now, so claiming it here too pushed the footer a full
     screen below the content. */
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  padding-bottom: 5rem; // room for sticky footer
}

// ── Nav ─────────────────────────────────────────────────────────────────────

.find-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  height: 3.25rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  flex-shrink: 0;

  &__back {
    font-size: 0.875rem;
    color: var(--color-muted);
    text-decoration: none;
    &:hover { color: var(--color-text); }
  }

  &__title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

.find-main {
  flex: 1;
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  padding: 1.25rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

// ── Search ───────────────────────────────────────────────────────────────────

.find-search {
  &__input {
    width: 100%;
    padding: 0.625rem 1rem;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 0.9375rem;
    background: var(--color-surface);
    color: var(--color-text);
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s;

    &:focus { border-color: var(--color-accent); }
    &::placeholder { color: var(--color-muted); }
  }
}

// ── State ────────────────────────────────────────────────────────────────────

.find-link {
  color: var(--color-accent);
  text-decoration: none;
  font-weight: 500;
  &:hover { text-decoration: underline; }
}

// ── List ─────────────────────────────────────────────────────────────────────

.find-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.find-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover:not(.find-card--requested) {
    border-color: var(--color-accent);
  }

  &--selected {
    border-color: var(--color-accent);
    background: rgba(var(--color-accent-rgb), 0.06);
  }

  &--requested {
    cursor: default;
    opacity: 0.7;
  }

  &__avatar {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;

    img { width: 100%; height: 100%; object-fit: cover; }
  }

  &__avatar-fallback {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-muted);
  }

  &__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  &__name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__bio {
    font-size: 0.8125rem;
    color: var(--color-muted);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-muted);
    margin: 0;
  }

  &__tag {
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    font-size: 0.6875rem;
    font-weight: 600;

    &--pending {
      background: rgba(234, 179, 8, 0.12);
      color: #ca8a04;
    }
  }

  &__check {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    border: 2px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    flex-shrink: 0;
    color: var(--color-accent);
    transition: border-color 0.15s, background 0.15s;

    .find-card--selected & {
      border-color: var(--color-accent);
      background: var(--color-accent);
      color: var(--color-on-accent);
    }
  }
}

// ── Load more ────────────────────────────────────────────────────────────────

.find-more {
  display: flex;
  justify-content: center;
  padding-top: 0.5rem;
}

// ── Footer ───────────────────────────────────────────────────────────────────

.find-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.25rem;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  z-index: 10;

  &__count {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }
}

.find-error {
  position: fixed;
  bottom: 4.5rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.875rem;
  color: #dc2626;
  background: var(--color-surface);
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.875rem;
  white-space: nowrap;
}

// ── Spinner ──────────────────────────────────────────────────────────────────

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

</style>
