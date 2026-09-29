<template>
  <div class="upage">
    <AppNav />

    <div v-if="loading" class="upage__state"><div class="spinner" /></div>

    <div v-else-if="!profile" class="upage__state">
      <p class="upage__state-title">User not found</p>
      <p class="upage__state-hint">The name may have changed, or the account no longer exists.</p>
      <NuxtLink to="/leaderboard" class="pbtn pbtn--primary">Go to the leaderboard</NuxtLink>
    </div>

    <div v-else class="upage__wrap">
      <ProfileHero
        :display-name="profile.display_name"
        :username="profile.username"
        :avatar-url="profile.avatar_url"
        :role="profile.role"
        :age="profile.age"
        :gender="profile.gender"
        :created-at="profile.created_at"
        :stats="profile.stats"
      >
        <template #status>
          <OnlineIndicator class="upage__online" :user-id="profile.id" :last-seen-at="profile.last_seen_at" />
        </template>
        <template #actions>
          <NuxtLink v-if="profile.is_self" to="/profile" class="pbtn">Edit your profile</NuxtLink>
          <template v-else>
            <button class="pbtn pbtn--primary" type="button" @click="toggleMessage">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
              {{ showMessageForm ? 'Close' : 'Message' }}
            </button>
            <button
              class="pbtn"
              :class="{ 'pbtn--active': profile.is_favorited }"
              type="button"
              :disabled="togglingFavorite"
              :aria-pressed="profile.is_favorited"
              @click="handleToggleFavorite"
            >
              <svg viewBox="0 0 24 24" :fill="profile.is_favorited ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
              {{ profile.is_favorited ? 'Favorited' : 'Favorite' }}
            </button>
          </template>
          <button class="pbtn" type="button" @click="copyProfileLink">{{ copiedLink ? 'Copied' : 'Copy link' }}</button>
        </template>
      </ProfileHero>

      <form v-if="showMessageForm" class="ppanel msg-form" @submit.prevent="handleSendMessage">
        <label class="msg-form__label" for="u-msg">Message {{ name }}</label>
        <textarea
          id="u-msg"
          ref="messageBox"
          v-model="messageContent"
          class="msg-form__input"
          rows="3"
          maxlength="5000"
          :placeholder="`Say hi to ${name}…`"
        />
        <div class="msg-form__foot">
          <p class="msg-form__hint">They see it as a request and can accept or decline.</p>
          <button class="pbtn pbtn--primary" type="submit" :disabled="sending || !messageContent.trim()">
            {{ sending ? 'Sending…' : 'Send request' }}
          </button>
        </div>
        <p v-if="sendError" class="msg-form__error">{{ sendError }}</p>
      </form>

      <div class="upage__grid">
        <section class="ppanel">
          <h2 class="ppanel__title">About</h2>
          <p v-if="profile.bio" class="about">{{ profile.bio }}</p>
          <p v-else class="about about--empty">{{ name }} has not written anything yet.</p>
        </section>

        <NuxtLink v-if="lock" :to="`/lock/${lock.public_id}`" class="lockcard">
          <span class="lockcard__live" :class="{ 'lockcard__live--paused': lock.paused }" aria-hidden="true" />
          <span class="lockcard__text">
            <strong>{{ lock.paused ? 'Lock paused' : 'Currently locked' }}</strong>
            <span>{{ lockSummary }}</span>
          </span>
          <span class="pbtn pbtn--sm">Open</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PublicProfile } from '~/types'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const username = route.params.username as string
useHead({ title: `@${username} | ChastHub` })

const { authFetch } = useAuthFetch()
const { startConversation } = useMessaging()
const { addFavorite, removeFavorite } = useFavorites()

const loading = ref(true)
const profile = ref<PublicProfile | null>(null)
const showMessageForm = ref(false)
const messageContent = ref('')
const messageBox = ref<HTMLTextAreaElement | null>(null)
const sending = ref(false)
const sendError = ref('')
const togglingFavorite = ref(false)
const copiedLink = ref(false)

onMounted(async () => {
  try {
    profile.value = await authFetch<PublicProfile>(`/api/profiles/${encodeURIComponent(username)}`)
  }
  catch { /* stays null: the "not found" state */ }
  finally { loading.value = false }
})

const name = computed(() => profile.value?.display_name ?? profile.value?.username ?? 'them')
const lock = computed(() => profile.value?.stats?.public_lock ?? null)

const lockSummary = computed(() => {
  const l = lock.value
  if (!l) return ''
  const parts: string[] = []
  if (l.ends_at) {
    const ms = new Date(l.ends_at).getTime() - Date.now()
    if (ms > 0) {
      const h = Math.floor(ms / 3_600_000)
      parts.push(h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m left`)
    }
  }
  else {
    parts.push('Looking for a keyholder')
  }
  if (l.visitor_permission === 'both') parts.push('anyone can add or remove time')
  else if (l.visitor_permission === 'add') parts.push('anyone can add time')
  else if (l.visitor_permission === 'remove') parts.push('anyone can remove time')
  return parts.join(' · ')
})

async function toggleMessage() {
  showMessageForm.value = !showMessageForm.value
  if (showMessageForm.value) {
    await nextTick()
    messageBox.value?.focus()
  }
}

async function copyProfileLink() {
  if (!profile.value?.username) return
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
    if (profile.value.is_favorited) await removeFavorite(profile.value.id)
    else await addFavorite(profile.value.id)
    profile.value.is_favorited = !profile.value.is_favorited
  }
  catch { /* state stays as it was */ }
  finally {
    togglingFavorite.value = false
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/profile' as *;

.upage {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);

  &__wrap {
    width: 100%;
    max-width: 1100px;
    box-sizing: border-box;
    margin: 0 auto;
    padding: 24px 20px 64px;
  }

  &__state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 64px 20px;
    text-align: center;
  }

  &__state-title { margin: 0; font-family: var(--font-display); font-size: 28px; font-weight: 700; }
  &__state-hint { margin: 0 0 8px; color: var(--color-text-muted); }

  &__online { margin-top: 10px; }

  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 20px;
    margin-top: 20px;
    align-items: start;

    &:has(> :only-child) { grid-template-columns: minmax(0, 1fr); }

    @media (max-width: 820px) {
      grid-template-columns: minmax(0, 1fr);

      .lockcard { order: -1; }
    }
  }

  @media (max-width: 700px) {
    &__wrap { padding: 16px 14px 48px; }
  }
}

.about {
  margin: 0;
  font-size: 16px;
  line-height: 1.6;
  color: #CFC5F2;
  white-space: pre-line;
  overflow-wrap: anywhere;

  &--empty { color: var(--color-text-muted); font-style: italic; }
}

.lockcard {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border-radius: 20px;
  background: var(--color-surface);
  border: 1px solid rgba(var(--color-accent-rgb), 0.35);
  color: var(--color-text);
  text-decoration: none;
  transition: border-color 0.15s, transform 0.1s;

  &:hover { border-color: var(--color-accent); text-decoration: none; }
  &:active { transform: scale(0.99); }

  &__live {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--color-accent);
    box-shadow: 0 0 10px var(--color-accent);
    animation: pulse-dot 2s ease-in-out infinite;

    &--paused { background: var(--color-warn); box-shadow: none; animation: none; }
  }

  &__text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;

    strong { font-family: var(--font-display); font-size: 16px; }
    span { font-size: 13px; color: var(--color-text-muted); line-height: 1.45; }
  }
}

.msg-form {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__label { font-weight: 600; }

  &__input {
    padding: 12px 14px;
    border: 1.5px solid var(--color-border);
    border-radius: 14px;
    background: var(--color-bg);
    color: var(--color-text);
    font: 16px/1.5 var(--font-sans);
    resize: vertical;
    outline: none;

    &:focus { border-color: var(--color-accent); }
  }

  &__foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  &__hint { margin: 0; font-size: 13px; color: var(--color-text-muted); }
  &__error { margin: 0; font-size: 14px; color: var(--color-danger); }
}
</style>
