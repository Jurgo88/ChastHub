<template>
  <div class="dash">
    <AppNav />

    <div v-if="loading" class="dash-state">
      <div class="spinner" />
    </div>

    <div v-else class="dash-body">
      <div class="dash-header">
        <div class="dash-header__text">
          <h1 class="dash-header__title">Messages</h1>
          <p class="dash-header__sub">Direct messages, independent of any lock</p>
        </div>
        <button v-if="tab === 'chats'" class="btn btn--primary msg-cta" @click="showNewMessage = !showNewMessage">
          <svg v-if="!showNewMessage" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M11.3 2.3a1.5 1.5 0 0 1 2.1 2.1L5.5 12.3l-3.3 1 1-3.3 8.1-7.7z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
          </svg>
          {{ showNewMessage ? 'Cancel' : 'New message' }}
        </button>
      </div>

      <!-- TASK-143 — user search used to be its own top-level page called
           Discover. That name now belongs to the loq list, and looking
           someone up is how a conversation starts, so it lives here. -->
      <div class="tabs">
        <button class="tabs__btn" :class="{ 'tabs__btn--active': tab === 'chats' }" @click="tab = 'chats'">Chats</button>
        <button class="tabs__btn" :class="{ 'tabs__btn--active': tab === 'people' }" @click="tab = 'people'">People</button>
      </div>

      <!-- People tab -->
      <div v-if="tab === 'people'" class="search-tab">
        <input
          v-model="query"
          class="search-input"
          :placeholder="canSearchByName ? 'Search by name or username…' : 'Search by username…'"
          autocomplete="off"
          @input="onQueryInput"
        >
        <p v-if="!canSearchByName" class="search-hint">
          Searching by name comes with
          <NuxtLink to="/subscription/upgrade">a subscription</NuxtLink>.
        </p>

        <div v-if="searching" class="dash-state">
          <div class="spinner spinner--sm" />
        </div>
        <p v-else-if="query.trim().length >= 2 && results.length === 0" class="search-empty">
          No profiles match "{{ query }}".
        </p>

        <div v-if="results.length" class="user-list">
          <div v-for="p in results" :key="p.id" class="user-row">
            <!-- Only a profile with a username has a page to link to. -->
            <component :is="p.username ? NuxtLink : 'div'" :to="p.username ? `/user/${p.username}` : undefined" class="user-row__link">
              <UserAvatar class="user-row__avatar" :avatar-url="p.avatar_url" :display-name="p.display_name" />
              <div class="user-row__body">
                <p class="user-row__name">{{ p.display_name ?? p.username }}</p>
                <p class="user-row__meta"><template v-if="p.username">@{{ p.username }} · </template>{{ p.role }}</p>
              </div>
            </component>
            <button class="btn btn--ghost btn--sm" @click="messageUser(p)">Message</button>
          </div>
        </div>

        <template v-if="!query.trim()">
          <h2 class="msg-list__section">Favorites</h2>
          <div v-if="loadingFavorites" class="dash-state">
            <div class="spinner spinner--sm" />
          </div>
          <p v-else-if="favorites.length === 0" class="search-empty">
            No favorites yet — heart a profile to save it here.
          </p>
          <div v-else class="user-list">
            <div v-for="fav in favorites" :key="fav.favorite_id" class="user-row">
              <component :is="fav.profile.username ? NuxtLink : 'div'" :to="fav.profile.username ? `/user/${fav.profile.username}` : undefined" class="user-row__link">
                <UserAvatar class="user-row__avatar" :avatar-url="fav.profile.avatar_url" :display-name="fav.profile.display_name" />
                <div class="user-row__body">
                  <p class="user-row__name">{{ fav.profile.display_name ?? fav.profile.username }}</p>
                  <p class="user-row__meta"><template v-if="fav.profile.username">@{{ fav.profile.username }} · </template>{{ fav.profile.role }}</p>
                </div>
              </component>
              <button class="btn btn--ghost btn--sm" @click="messageUser(fav.profile)">Message</button>
            </div>
          </div>
        </template>
      </div>

      <form v-if="tab === 'chats' && showNewMessage" class="new-msg" @submit.prevent="handleStartConversation">
        <div class="form-group">
          <label class="form-label">To</label>
          <!-- Picked from People: addressed by id, so it works for someone
               with no username too. -->
          <div v-if="recipient" class="new-msg__recipient">
            <UserAvatar class="new-msg__recipient-avatar" :avatar-url="recipient.avatar_url" :display-name="recipient.display_name" />
            <span class="new-msg__recipient-name">{{ recipient.display_name ?? recipient.username }}</span>
            <button type="button" class="new-msg__recipient-clear" aria-label="Change recipient" @click="recipient = null">✕</button>
          </div>
          <div v-else class="new-msg__to">
            <span class="new-msg__at">@</span>
            <input
              v-model="newMsgUsername"
              class="form-input new-msg__to-field"
              placeholder="username"
              autocomplete="off"
            />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Message</label>
          <textarea
            v-model="newMsgContent"
            class="form-input form-input--textarea"
            rows="3"
            placeholder="Say hi…"
          />
        </div>
        <p v-if="newMsgError" class="new-msg__error">{{ newMsgError }}</p>
        <div class="new-msg__actions">
          <button type="button" class="btn btn--ghost" @click="showNewMessage = false">Cancel</button>
          <button
            class="btn btn--primary"
            type="submit"
            :disabled="startingConversation || !(recipient || newMsgUsername.trim()) || !newMsgContent.trim()"
          >
            {{ startingConversation ? 'Sending…' : 'Send request' }}
          </button>
        </div>
      </form>

      <div v-if="tab === 'chats'" class="msg-list">

        <template v-if="incomingRequests.length">
          <h2 class="msg-list__section">Message requests</h2>
          <NuxtLink
            v-for="c in incomingRequests"
            :key="c.id"
            :to="`/messages/${c.id}`"
            class="msg-row msg-row--request"
          >
            <UserAvatar class="msg-row__avatar" :avatar-url="c.other_user?.avatar_url" :display-name="c.other_user?.display_name" />
            <div class="msg-row__body">
              <div class="msg-row__top">
                <span class="msg-row__nameGroup">
                  <span class="msg-row__name">{{ c.other_user?.display_name ?? c.other_user?.username ?? 'Unknown' }}</span>
                  <AdminBadge v-if="c.other_user?.is_admin" />
                </span>
                <span class="msg-row__time">{{ timeAgo(c.created_at) }}</span>
              </div>
              <p class="msg-row__preview">{{ c.last_message?.content ?? 'Wants to message you' }}</p>
            </div>
            <span class="msg-row__tag">Request</span>
          </NuxtLink>
        </template>

        <h2 class="msg-list__section">Conversations</h2>
        <template v-if="conversations.length">
          <NuxtLink
            v-for="c in conversations"
            :key="c.id"
            :to="`/messages/${c.id}`"
            class="msg-row"
          >
            <UserAvatar class="msg-row__avatar" :avatar-url="c.other_user?.avatar_url" :display-name="c.other_user?.display_name" />
            <div class="msg-row__body">
              <div class="msg-row__top">
                <span class="msg-row__nameGroup">
                  <span class="msg-row__name">{{ c.other_user?.display_name ?? c.other_user?.username ?? 'Unknown' }}</span>
                  <AdminBadge v-if="c.other_user?.is_admin" />
                </span>
                <span class="msg-row__time">{{ c.last_message_at ? timeAgo(c.last_message_at) : '' }}</span>
              </div>
              <p class="msg-row__preview">{{ c.last_message?.content ?? 'No messages yet' }}</p>
            </div>
          </NuxtLink>
        </template>
        <div v-else-if="!incomingRequests.length && !sentRequests.length" class="dash-state dash-state--inline">
          <span class="dash-state__icon">💬</span>
          <p class="dash-state__title">No conversations yet</p>
          <p class="dash-state__hint">Message someone from their profile to get started.</p>
        </div>

        <template v-if="sentRequests.length">
          <h2 class="msg-list__section">Sent requests</h2>
          <NuxtLink
            v-for="c in sentRequests"
            :key="c.id"
            :to="`/messages/${c.id}`"
            class="msg-row msg-row--pending"
          >
            <UserAvatar class="msg-row__avatar" :avatar-url="c.other_user?.avatar_url" :display-name="c.other_user?.display_name" />
            <div class="msg-row__body">
              <div class="msg-row__top">
                <span class="msg-row__nameGroup">
                  <span class="msg-row__name">{{ c.other_user?.display_name ?? c.other_user?.username ?? 'Unknown' }}</span>
                  <AdminBadge v-if="c.other_user?.is_admin" />
                </span>
                <span class="msg-row__time">{{ timeAgo(c.created_at) }}</span>
              </div>
              <p class="msg-row__preview">{{ c.last_message?.content ?? 'Waiting for a response' }}</p>
            </div>
          </NuxtLink>
        </template>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Conversation, FavoriteEntry } from '~/types'

definePageMeta({ middleware: 'auth' })

const { fetchConversations, startConversation } = useMessaging()
const { fetchFavorites } = useFavorites()
const { authFetch } = useAuthFetch()

interface SearchProfile {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  role: string
}

const NuxtLink = resolveComponent('NuxtLink')
const authStore = useAuthStore()
// TASK-159 — mirrors the server's rule in profiles/search.get.ts, which is
// what actually decides; this only picks the placeholder and the hint.
const canSearchByName = computed(() => authStore.hasAccess || authStore.isAdmin)

const tab = ref<'chats' | 'people'>('chats')

const loading = ref(true)
const conversations = ref<Conversation[]>([])
const incomingRequests = ref<Conversation[]>([])
const sentRequests = ref<Conversation[]>([])

const showNewMessage = ref(false)
const newMsgUsername = ref('')
const recipient = ref<SearchProfile | null>(null)
const newMsgContent = ref('')
const startingConversation = ref(false)
const newMsgError = ref('')

// TASK-143 — moved here from the old /search page, endpoint unchanged.
const query = ref('')
const results = ref<SearchProfile[]>([])
const searching = ref(false)
const favorites = ref<FavoriteEntry[]>([])
const loadingFavorites = ref(false)
let favoritesLoaded = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onQueryInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  const q = query.value.trim()
  if (q.length < 2) { results.value = []; return }
  debounceTimer = setTimeout(() => runSearch(q), 300)
}

async function runSearch(q: string) {
  searching.value = true
  try {
    const res = await authFetch<{ profiles: SearchProfile[] }>(`/api/profiles/search?q=${encodeURIComponent(q)}`)
    // No username means no profile page, but the row still gets a Message
    // button — most accounts never set one (TASK-159).
    results.value = res.profiles
  }
  catch { results.value = [] }
  finally { searching.value = false }
}

// Straight into the compose form with the recipient filled in — the reason
// you looked someone up here is to write to them.
function messageUser(profile: SearchProfile) {
  tab.value = 'chats'
  showNewMessage.value = true
  recipient.value = profile
  newMsgUsername.value = ''
  newMsgError.value = ''
}

// A recipient picked earlier must not silently carry over into the next
// message written from the header button.
watch(showNewMessage, (open) => { if (!open) recipient.value = null })

watch(tab, async (t) => {
  if (t !== 'people' || favoritesLoaded) return
  loadingFavorites.value = true
  try {
    favorites.value = await fetchFavorites()
    favoritesLoaded = true
  }
  catch { /* the empty state covers it */ }
  finally { loadingFavorites.value = false }
})

onMounted(async () => {
  try {
    const res = await fetchConversations()
    conversations.value = res.conversations
    incomingRequests.value = res.incoming_requests
    sentRequests.value = res.sent_requests
  }
  finally {
    loading.value = false
  }
})

async function handleStartConversation() {
  const username = newMsgUsername.value.trim().replace(/^@/, '').toLowerCase()
  const content = newMsgContent.value.trim()
  if (!(recipient.value || username) || !content) return

  startingConversation.value = true
  newMsgError.value = ''
  try {
    const recipientId = recipient.value?.id
      ?? (await authFetch<{ id: string }>(`/api/profiles/lookup?username=${encodeURIComponent(username)}`)).id
    const result = await startConversation(recipientId, content)
    await navigateTo(`/messages/${result.conversation_id}`)
  }
  catch (err) {
    const fe = err as { data?: { message?: string }; message?: string }
    newMsgError.value = fe?.data?.message ?? fe?.message ?? 'Something went wrong'
  }
  finally {
    startingConversation.value = false
  }
}

// timeAgo comes from composables/useLoqFormat.ts
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/shared-ui' as *;
.tabs {
  display: flex;
  gap: 0.375rem;
  margin-bottom: 0.25rem;

  &__btn {
    padding: 0.375rem 0.875rem;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    background: none;
    color: var(--color-muted);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;

    &:hover { border-color: var(--color-accent); color: var(--color-accent); }

    &--active {
      background: var(--color-accent);
      border-color: var(--color-accent);
      color: var(--color-on-accent);
    }
  }
}

.search-tab {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-input {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: 0.625rem;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.9375rem;
  outline: none;
  &:focus { border-color: var(--color-accent); }
}

.search-hint {
  margin: -0.5rem 0 0;
  font-size: 0.8125rem;
  color: var(--color-muted);

  a { color: var(--color-accent); }
}

.search-empty {
  font-size: 0.875rem;
  color: var(--color-muted);
  text-align: center;
  padding: 2rem 1rem;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1.5px solid var(--color-border);
  border-radius: 0.875rem;
  transition: border-color 0.12s, background 0.12s;

  &:hover {
    border-color: var(--color-accent);
    background: rgba(var(--color-accent-rgb), 0.05);
  }

  &__link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
    text-decoration: none;
    color: inherit;
  }

  &__avatar { width: 2.5rem; height: 2.5rem; flex-shrink: 0; }
  &__body { flex: 1; min-width: 0; }

  &__name {
    margin: 0;
    font-weight: 600;
    font-size: 0.9375rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    margin: 0.125rem 0 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
    text-transform: capitalize;
  }
}

.spinner--sm {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }


// ── New message CTA ──────────────────────────────────────────────────────────
// Plain shared .btn--primary, full width (dash-header is a column flex, so
// this is its natural stretched size) with a small icon gap added.

.msg-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
}

// ── New message form ─────────────────────────────────────────────────────────

.new-msg {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  margin-bottom: 0.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text);
}

.form-input {
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.9375rem;
  font-family: inherit;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;

  &:focus { border-color: var(--color-accent); }

  &--textarea { resize: vertical; }
}

.new-msg__to {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  overflow: hidden;

  &-field {
    border: none;
    border-radius: 0;
  }
}

.new-msg__recipient {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem 0.4rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;

  &-avatar {
    width: 1.75rem;
    height: 1.75rem;
    flex-shrink: 0;
  }

  &-name {
    flex: 1;
    min-width: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &-clear {
    border: none;
    background: none;
    color: var(--color-muted);
    font-size: 0.875rem;
    padding: 0.25rem 0.4rem;
    cursor: pointer;
    &:hover { color: var(--color-text); }
  }
}

.new-msg__at {
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  background: var(--color-border);
  color: var(--color-muted);
  font-size: 0.9375rem;
  border-right: 1px solid var(--color-border);
}

.new-msg__error {
  font-size: 0.8125rem;
  color: var(--color-danger);
  margin: 0;
}

.new-msg__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
}

// ── List ─────────────────────────────────────────────────────────────────────

.msg-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;

  &__section {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-muted);
    margin: 1.25rem 0 0.375rem;

    &:first-child { margin-top: 0; }
  }
}

.dash-state--inline {
  padding: 2.5rem 1rem;
}

.msg-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.75rem;
  border-radius: 0.75rem;
  text-decoration: none;
  color: inherit;
  transition: background 0.12s;

  &:hover { background: var(--color-surface); }

  &--request:hover,
  &--pending:hover { background: var(--color-surface); }

  &__avatar { width: 2.75rem; height: 2.75rem; flex-shrink: 0; }

  &__body { min-width: 0; }

  &__top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  &__nameGroup {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
  }

  &__name {
    font-weight: 600;
    font-size: 0.9375rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__time {
    font-size: 0.75rem;
    color: var(--color-muted);
    flex-shrink: 0;
  }

  &__preview {
    margin: 0.1rem 0 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &--request &__preview { color: var(--color-text); }

  &__tag {
    justify-self: end;
    flex-shrink: 0;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    background: rgba(var(--color-accent-rgb), 0.15);
    color: var(--color-accent);
  }
}
</style>
