<template>
  <Teleport to="body">
    <div class="nm-overlay" @click.self="$emit('close')">
      <div class="nm" role="dialog" aria-modal="true" aria-labelledby="nm-title">
        <header class="nm__head">
          <button v-if="picked" class="nm__icon" type="button" aria-label="Back" @click="picked = null">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <h2 id="nm-title">{{ picked ? `Message ${pickedName}` : 'New message' }}</h2>
          <button class="nm__icon" type="button" aria-label="Close" @click="$emit('close')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <!-- Step 1: who -->
        <template v-if="!picked">
          <label class="nm__search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              ref="searchEl"
              v-model="query"
              type="search"
              :placeholder="canSearchByName ? 'Search by name or @username' : 'Search by @username'"
              aria-label="Search people"
              @input="onInput"
            >
          </label>
          <p v-if="!canSearchByName" class="nm__hint">Searching by display name is part of Premium. Everyone can look up an exact @username.</p>

          <div class="nm__list">
            <template v-if="query.trim().length < 2">
              <p class="nm__label">Favorites</p>
              <div v-if="!inbox.favoritesLoaded.value" class="nm__state"><div class="spinner spinner--sm" /></div>
              <p v-else-if="!inbox.favorites.value.length" class="nm__state">
                No favorites yet. Tap the heart on a profile or in a chat to keep people here.
              </p>
              <button v-for="f in inbox.favorites.value" v-else :key="f.favorite_id" class="person" type="button" @click="pick(f.profile)">
                <UserAvatar class="person__av" :avatar-url="f.profile.avatar_url" :display-name="f.profile.display_name" />
                <span class="person__mid">
                  <b>{{ f.profile.display_name ?? f.profile.username }}</b>
                  <span>{{ subline(f.profile) }}</span>
                </span>
                <span class="person__go">{{ inbox.findByUser(f.profile.id) ? 'Open chat' : 'Message' }}</span>
              </button>
            </template>

            <template v-else>
              <div v-if="searching" class="nm__state"><div class="spinner spinner--sm" /></div>
              <p v-else-if="searchError" class="nm__state">{{ searchError }}</p>
              <p v-else-if="!results.length" class="nm__state">Nobody found for "{{ query.trim() }}".</p>
              <button v-for="p in results" v-else :key="p.id" class="person" type="button" @click="pick(p)">
                <UserAvatar class="person__av" :avatar-url="p.avatar_url" :display-name="p.display_name" />
                <span class="person__mid">
                  <b>{{ p.display_name ?? p.username }}</b>
                  <span>{{ subline(p) }}</span>
                </span>
                <span class="person__go">{{ inbox.findByUser(p.id) ? 'Open chat' : 'Message' }}</span>
              </button>
            </template>
          </div>
        </template>

        <!-- Step 2: first message -->
        <form v-else class="nm__compose" @submit.prevent="send">
          <div class="person person--static">
            <UserAvatar class="person__av" :avatar-url="picked.avatar_url" :display-name="picked.display_name" />
            <span class="person__mid">
              <b>{{ pickedName }}</b>
              <span>{{ subline(picked) }}</span>
            </span>
          </div>
          <textarea
            ref="textEl"
            v-model="content"
            rows="4"
            maxlength="5000"
            placeholder="Introduce yourself and say what you are looking for."
            aria-label="First message"
          />
          <p class="nm__hint">They get a message request. You can write again once they accept.</p>
          <p v-if="sendError" class="nm__err">{{ sendError }}</p>
          <button class="pbtn pbtn--primary" type="submit" :disabled="!content.trim() || sending">
            {{ sending ? 'Sending…' : 'Send request' }}
          </button>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { roleLabel } from '~/utils/profileLabels'

interface Person {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  role: string
}

const emit = defineEmits<{ close: [] }>()

const inbox = useDmInbox()
const authStore = useAuthStore()
const { authFetch } = useAuthFetch()
const { startConversation } = useMessaging()

// Mirrors the rule in server/api/profiles/search.get.ts, which decides.
const canSearchByName = computed(() => authStore.hasAccess || authStore.isAdmin)

const query = ref('')
const results = ref<Person[]>([])
const searching = ref(false)
const searchError = ref('')
const searchEl = ref<HTMLInputElement | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

const picked = ref<Person | null>(null)
const pickedName = computed(() => picked.value?.display_name ?? picked.value?.username ?? '')
const content = ref('')
const sending = ref(false)
const sendError = ref('')
const textEl = ref<HTMLTextAreaElement | null>(null)

function subline(p: Person) {
  const role = roleLabel(p.role)
  return [p.username ? `@${p.username}` : '', role === 'Admin' ? '' : role].filter(Boolean).join(' · ')
}

function onInput() {
  if (timer) clearTimeout(timer)
  const q = query.value.trim()
  searchError.value = ''
  if (q.length < 2) { results.value = []; return }
  searching.value = true
  timer = setTimeout(() => runSearch(q), 300)
}

async function runSearch(q: string) {
  try {
    const res = await authFetch<{ profiles: Person[] }>(`/api/profiles/search?q=${encodeURIComponent(q)}`)
    if (q === query.value.trim()) results.value = res.profiles
  }
  catch { searchError.value = 'Search failed. Try again.' }
  finally { searching.value = false }
}

// Someone you already talk to opens the existing chat instead of a new request.
async function pick(p: Person) {
  const existing = inbox.findByUser(p.id)
  if (existing) {
    emit('close')
    await navigateTo(`/messages/${existing.id}`)
    return
  }
  picked.value = p
  sendError.value = ''
  nextTick(() => textEl.value?.focus())
}

async function send() {
  const p = picked.value
  const text = content.value.trim()
  if (!p || !text || sending.value) return
  sending.value = true
  sendError.value = ''
  try {
    const res = await startConversation(p.id, text)
    await inbox.reload()
    emit('close')
    await navigateTo(`/messages/${res.conversation_id}`)
  }
  catch (err) { sendError.value = (err as Error)?.message || 'Could not send. Try again.' }
  finally { sending.value = false }
}

function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close') }

onMounted(() => {
  inbox.loadFavorites()
  document.addEventListener('keydown', onKey)
  nextTick(() => searchEl.value?.focus())
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped lang="scss">
@use '~/assets/styles/profile' as *;

.nm-overlay {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(8, 0, 30, 0.72);
  backdrop-filter: blur(4px);
}

.nm {
  width: 100%;
  max-width: 460px;
  max-height: min(640px, 90dvh);
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5);
  overflow: hidden;

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 16px 12px 20px;

    h2 {
      flex: 1;
      margin: 0;
      font: 700 20px var(--font-display);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  &__icon {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 0;
    background: none;
    color: var(--color-text-muted);
    display: grid;
    place-items: center;
    cursor: pointer;

    svg { width: 20px; height: 20px; }
    &:hover { background: rgba(255, 255, 255, 0.07); color: var(--color-text); }
  }

  &__search {
    margin: 0 20px 8px;
    height: 44px;
    border-radius: 14px;
    border: 1.5px solid var(--color-border);
    background: var(--color-bg);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    color: var(--color-text-muted);

    &:focus-within { border-color: var(--color-accent); }
    svg { width: 17px; height: 17px; flex-shrink: 0; }

    input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: 0;
      background: none;
      color: var(--color-text);
      font: 15px var(--font-sans);
      &::placeholder { color: var(--color-text-muted); }
    }
  }

  &__hint { margin: 0 20px 8px; font-size: 12px; color: var(--color-text-muted); line-height: 1.45; }
  &__err { margin: 0 20px 8px; font-size: 13px; color: var(--color-danger); }

  &__list { flex: 1; min-height: 120px; overflow-y: auto; padding: 4px 0 12px; }

  &__label {
    margin: 8px 20px 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  &__state {
    display: flex;
    justify-content: center;
    margin: 0;
    padding: 24px 24px;
    text-align: center;
    font-size: 14px;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  &__compose {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 0 20px;

    textarea {
      margin: 0 20px;
      resize: vertical;
      min-height: 110px;
      border-radius: 16px;
      border: 1.5px solid var(--color-border);
      background: var(--color-bg);
      padding: 12px 14px;
      color: var(--color-text);
      font: 15px/1.45 var(--font-sans);
      outline: 0;

      &:focus { border-color: var(--color-accent); }
      &::placeholder { color: var(--color-text-muted); }
    }

    .nm__hint, .nm__err { margin-bottom: 0; }
    .pbtn { margin: 4px 20px 0; }
  }
}

.person {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  border: 0;
  background: none;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
  font: inherit;

  &:hover { background: rgba(79, 23, 135, 0.35); }
  &--static { cursor: default; &:hover { background: none; } }

  &__av { display: block; width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0; }
  &__mid { flex: 1; min-width: 0; display: flex; flex-direction: column; }

  &__mid b { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  &__mid span { font-size: 12px; color: var(--color-text-muted); }

  &__go {
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 700;
    color: var(--color-accent);
  }
}

@media (max-width: 600px) {
  .nm-overlay { padding: 0; place-items: end stretch; }
  .nm { max-width: none; max-height: 92dvh; border-radius: 24px 24px 0 0; }
}
</style>
