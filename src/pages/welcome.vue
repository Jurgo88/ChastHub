<script setup lang="ts">
import type { Profile } from '~/types'

// First stop after signing up (and for any account that still has no
// username): pick a public name, or keep the one we suggest. /dashboard sends
// people here, so nobody ends up without a profile link.
definePageMeta({ layout: 'auth', authAside: 'welcome', middleware: 'auth' })
useHead({ title: 'Pick your name | ChastHub' })

const authStore = useAuthStore()
const { authFetch } = useAuthFetch()
const { availability, checkUsername } = useUsernameCheck()

const displayName = ref(authStore.profile?.display_name ?? '')
const username = ref(authStore.profile?.username ?? '')
const rolling = ref(false)
const saving = ref(false)
const error = ref('')

const isWearer = computed(() => authStore.profile?.role === 'loqee')

onMounted(async () => {
  // Already has a username: nothing to do here.
  if (authStore.profile?.username) return navigateTo('/dashboard', { replace: true })
  // The name generated at signup is kept; only the username needs a suggestion.
  if (displayName.value) {
    username.value = displayName.value
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20)
    checkUsername(username.value)
  }
  else {
    await roll()
  }
})

async function roll() {
  rolling.value = true
  error.value = ''
  try {
    const s = await authFetch<{ display_name: string; username: string }>('/api/profile/suggest-name')
    displayName.value = s.display_name
    username.value = s.username
    checkUsername(username.value)
  }
  catch {
    error.value = 'Could not suggest a name. Type your own instead.'
  }
  finally {
    rolling.value = false
  }
}

function onUsernameInput() {
  username.value = username.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
  checkUsername(username.value)
}

async function save() {
  error.value = ''
  if (!displayName.value.trim()) { error.value = 'Pick a display name.'; return }
  if (availability.value !== 'available') { error.value = 'Pick a username that is available.'; return }
  saving.value = true
  try {
    const updated = await authFetch<Profile>('/api/profile', {
      method: 'PATCH',
      body: { display_name: displayName.value.trim(), username: username.value },
    })
    authStore.setProfile(updated)
    await navigateTo('/dashboard', { replace: true })
  }
  catch (e: unknown) {
    const fe = e as { data?: { message?: string }; message?: string }
    error.value = fe?.data?.message ?? fe?.message ?? 'Could not save your name'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="auth-title">Pick your name</h1>
    <p class="auth-sub">
      This is how others see you in Key Drop, on Stats and in messages.
      Keep our suggestion, roll another one, or write your own. You can change it later.
    </p>

    <div class="welcome-preview">
      <UserAvatar class="welcome-preview__avatar" :display-name="displayName" />
      <div class="welcome-preview__text">
        <strong>{{ displayName || 'Your name' }}</strong>
        <span>chasthub.com/user/{{ username || 'yourname' }}</span>
      </div>
      <button class="welcome-roll" type="button" :disabled="rolling" @click="roll">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" />
          <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" />
        </svg>
        {{ rolling ? 'Rolling…' : 'Roll again' }}
      </button>
    </div>

    <form class="form" @submit.prevent="save">
      <div class="form__field">
        <label for="display-name">Display name</label>
        <input id="display-name" v-model="displayName" type="text" maxlength="50" autocomplete="off" :placeholder="isWearer ? 'CagedPet27' : 'StrictWarden41'">
      </div>

      <div class="form__field">
        <label for="username">Username</label>
        <div class="welcome-uname" :class="`welcome-uname--${availability}`">
          <span>chasthub.com/user/</span>
          <input id="username" v-model="username" type="text" maxlength="20" autocomplete="off" @input="onUsernameInput">
        </div>
        <UsernameStatus :state="availability" />
      </div>

      <p v-if="error" class="form__error" role="alert">{{ error }}</p>

      <button class="btn btn--primary" type="submit" :disabled="saving || availability !== 'available'">
        {{ saving ? 'Saving…' : 'Continue' }}
      </button>
    </form>
  </div>
</template>

<style scoped lang="scss">
.welcome-preview {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  margin: 8px 0 24px;
  border-radius: 18px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);

  &__avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;

    strong {
      font-family: var(--font-display);
      font-size: 18px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    span {
      font-size: 13px;
      color: var(--color-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.welcome-roll {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1.5px solid var(--color-border);
  background: none;
  color: var(--color-text);
  font: 600 13px var(--font-sans);
  cursor: pointer;
  flex-shrink: 0;

  &:hover:not(:disabled) { border-color: var(--color-accent); }
  &:disabled { opacity: 0.5; cursor: wait; }
}

.welcome-uname {
  display: flex;
  align-items: center;
  border: 1.5px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-bg);
  overflow: hidden;
  transition: border-color 0.15s;

  &:focus-within { border-color: var(--color-accent); }
  &--available { border-color: var(--color-success); }
  &--taken, &--invalid { border-color: var(--color-danger); }

  span {
    padding-left: 14px;
    font-size: 14px;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  input {
    flex: 1;
    min-width: 0;
    height: 48px;
    padding: 0 12px 0 2px;
    border: 0;
    background: none;
    color: var(--color-text);
    font: 16px var(--font-sans);
    outline: none;
  }
}
</style>
