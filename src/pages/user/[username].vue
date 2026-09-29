<template>
  <div class="dash">
    <AppNav />

    <div v-if="loading" class="dash-state">
      <div class="spinner" />
    </div>

    <div v-else-if="!profile" class="dash-state">
      <div class="dash-state__icon">🔍</div>
      <p class="dash-state__title">User not found</p>
      <NuxtLink to="/leaderboard" class="btn btn--primary">Back to Leaderboard</NuxtLink>
    </div>

    <div v-else class="dash-body">
      <article class="loq-card profile-card">
        <header class="profile-card__header">
          <UserAvatar class="profile-card__avatar" :avatar-url="profile.avatar_url" :display-name="profile.display_name" />
          <div class="profile-card__info">
            <h1 class="profile-card__name">{{ profile.display_name ?? profile.username }}</h1>
            <p v-if="profile.username" class="profile-card__username">
              @{{ profile.username }}
              <button class="profile-card__copy-link" :class="{ 'profile-card__copy-link--done': copiedLink }" @click="copyProfileLink">
                {{ copiedLink ? '✓ Copied' : '🔗 Copy link' }}
              </button>
            </p>
            <span class="profile-card__badges">
              <span class="role-badge" :class="`role-badge--${profile.role}`">{{ roleLabel(profile.role) }}</span>
              <!-- TASK-128 — staff marker, same badge the messaging surfaces use -->
              <AdminBadge v-if="profile.is_admin" />
            </span>
            <OnlineIndicator :user-id="profile.id" :last-seen-at="profile.last_seen_at" />
          </div>
        </header>

        <p v-if="profile.bio" class="profile-card__bio">{{ profile.bio }}</p>

        <div v-if="profile.is_self" class="profile-card__actions">
          <NuxtLink to="/profile" class="btn btn--ghost">Edit your profile</NuxtLink>
        </div>

        <template v-else>
          <div class="profile-card__actions">
            <button class="btn btn--primary" @click="showMessageForm = !showMessageForm">
              {{ showMessageForm ? 'Cancel' : '💬 Message' }}
            </button>
            <button
              class="btn btn--heart"
              :class="{ 'btn--heart-active': profile.is_favorited }"
              :disabled="togglingFavorite"
              @click="handleToggleFavorite"
            >
              {{ profile.is_favorited ? '♥ Favorited' : '♡ Favorite' }}
            </button>
          </div>

          <form v-if="showMessageForm" class="new-msg" @submit.prevent="handleSendMessage">
            <textarea
              v-model="messageContent"
              class="new-msg__textarea"
              rows="2"
              :placeholder="`Say hi to ${profile.display_name ?? profile.username}…`"
              autofocus
            />
            <button class="btn btn--primary" type="submit" :disabled="sending || !messageContent.trim()">
              {{ sending ? 'Sending…' : 'Send request' }}
            </button>
            <p v-if="sendError" class="new-msg__error">{{ sendError }}</p>
          </form>
        </template>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PublicProfile } from '~/types'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const username = route.params.username as string

const { authFetch } = useAuthFetch()
const { startConversation } = useMessaging()
const { addFavorite, removeFavorite } = useFavorites()

const loading = ref(true)
const profile = ref<PublicProfile | null>(null)
const showMessageForm = ref(false)
const messageContent = ref('')
const sending = ref(false)
const sendError = ref('')
const togglingFavorite = ref(false)
const copiedLink = ref(false)

onMounted(async () => {
  try {
    profile.value = await authFetch<PublicProfile>(`/api/profiles/${encodeURIComponent(username)}`)
  }
  catch { /* profile stays null -> "not found" state */ }
  finally { loading.value = false }
})

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

async function copyProfileLink() {
  if (!profile.value?.username || !import.meta.client) return
  await navigator.clipboard.writeText(`${window.location.origin}/user/${profile.value.username}`)
  copiedLink.value = true
  setTimeout(() => { copiedLink.value = false }, 2000)
}

async function handleSendMessage() {
  if (!profile.value || !messageContent.value.trim()) return
  sending.value = true
  sendError.value = ''
  try {
    const result = await startConversation(profile.value.id, messageContent.value.trim())
    await navigateTo(`/messages/${result.conversation_id}`)
  }
  catch (err: unknown) {
    sendError.value = (err as Error).message
  }
  finally {
    sending.value = false
  }
}

async function handleToggleFavorite() {
  if (!profile.value || togglingFavorite.value) return
  togglingFavorite.value = true
  try {
    if (profile.value.is_favorited) {
      await removeFavorite(profile.value.id)
    }
    else {
      await addFavorite(profile.value.id)
    }
    profile.value.is_favorited = !profile.value.is_favorited
  }
  catch { /* leave state unchanged on failure */ }
  finally {
    togglingFavorite.value = false
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/shared-ui' as *;

.profile-card {
  &__header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  &__avatar {
    width: 4.5rem;
    height: 4.5rem;
    flex-shrink: 0;
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  &__name {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
  }

  &__username {
    font-size: 0.875rem;
    color: var(--color-muted);
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__copy-link {
    display: inline-flex;
    align-items: center;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-muted);
    font-size: 0.75rem;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;

    &:hover { border-color: var(--color-accent); color: var(--color-accent); }

    &--done {
      border-color: var(--color-accent);
      color: var(--color-accent);
    }
  }

  &__bio {
    font-size: 0.9375rem;
    color: var(--color-text);
    line-height: 1.5;
    margin: 1rem 0 0;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }

  &__actions {
    display: flex;
    gap: 0.625rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }
}

.profile-card__badges {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.role-badge {
  align-self: flex-start;
}

.new-msg {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-top: 0.75rem;

  &__textarea {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 0.625rem;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.875rem;
    font-family: inherit;
    resize: vertical;
    outline: none;
    &:focus { border-color: var(--color-accent); }
  }

  &__error {
    font-size: 0.8125rem;
    color: var(--color-danger, #ff6b6b);
    margin: 0;
  }
}

// Page-specific overrides on top of the shared .btn base (smaller size,
// sits in a flex row that doesn't otherwise constrain cross-axis alignment).
.btn {
  font-size: 0.875rem;
  align-self: flex-start;

  &--heart {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-muted);
    &:hover:not(:disabled) { border-color: #ef4444; color: #ef4444; }
  }

  &--heart-active {
    border-color: rgba(239, 68, 68, 0.4);
    color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
  }
}
</style>
