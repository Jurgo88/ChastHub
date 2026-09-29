<template>
  <div class="th-wrap">
    <div v-if="inbox.loading.value && !conv" class="th-state"><div class="spinner" /></div>

    <div v-else-if="!conv" class="th-state">
      <strong>Conversation not found</strong>
      <p>It may have been declined or the account was deleted.</p>
      <NuxtLink to="/messages" class="pbtn pbtn--sm">Back to Messages</NuxtLink>
    </div>

    <template v-else>
      <!-- ── Header ─────────────────────────────────────────────────────── -->
      <header class="th">
        <NuxtLink to="/messages" class="th__back" aria-label="Back to Messages">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </NuxtLink>

        <component :is="profileLink ? NuxtLink : 'span'" :to="profileLink" class="th__av">
          <UserAvatar class="th__img" :avatar-url="other?.avatar_url" :display-name="other?.display_name" />
          <i v-if="isOnline(other?.id)" class="th__dot" />
        </component>

        <div class="th__mid">
          <component :is="profileLink ? NuxtLink : 'span'" :to="profileLink" class="th__name">{{ name }}</component>
          <div class="th__sub">
            <span v-if="rolePill" class="th__role">{{ rolePill }}</span>
            <OnlineIndicator :user-id="other?.id" :last-seen-at="other?.last_seen_at" />
            <NuxtLink v-if="conv.lock" :to="lockLink" class="th__lock">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              {{ lockLabel }}
            </NuxtLink>
          </div>
        </div>

        <button
          v-if="other"
          class="th__icon"
          :class="{ 'th__icon--on': isFavorite }"
          type="button"
          :aria-pressed="isFavorite"
          :aria-label="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
          :disabled="favBusy"
          @click="toggleFavorite"
        >
          <svg viewBox="0 0 24 24" :fill="isFavorite ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
        </button>

        <div v-if="other" ref="menuRoot" class="th__menu">
          <button class="th__icon" type="button" aria-haspopup="menu" :aria-expanded="menuOpen" aria-label="More" @click="menuOpen = !menuOpen">
            <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
          </button>
          <div v-if="menuOpen" class="th__menu-panel" role="menu">
            <NuxtLink v-if="profileLink" :to="profileLink" role="menuitem" @click="menuOpen = false">View profile</NuxtLink>
            <button type="button" role="menuitem" class="danger" @click="menuOpen = false; showReport = true">Report</button>
          </div>
        </div>
      </header>

      <!-- ── Messages ───────────────────────────────────────────────────── -->
      <div ref="scrollEl" class="msgs">
        <div v-if="loadingMessages" class="th-state th-state--inline"><div class="spinner spinner--sm" /></div>

        <template v-else>
          <!-- Incoming request: their words and the decision, nothing else. -->
          <div v-if="isIncoming" class="req">
            <b>Message request</b>
            <p>{{ name }} wants to message you. Accept to reply, or decline and they will not be told.</p>
            <div v-for="m in messages" :key="m.id" class="req__first">{{ m.content }}</div>
            <div class="req__btns">
              <button class="pbtn pbtn--primary" type="button" :disabled="responding" @click="accept">Accept</button>
              <button class="pbtn" type="button" :disabled="responding" @click="decline">Decline</button>
            </div>
            <p v-if="actionError" class="req__err">{{ actionError }}</p>
          </div>

          <template v-else>
            <button v-if="messages.length < total" class="msgs__older" type="button" :disabled="loadingOlder" @click="loadOlder">
              {{ loadingOlder ? 'Loading…' : 'Load earlier messages' }}
            </button>

            <div v-if="!messages.length" class="th-state th-state--inline">
              <p>No messages yet. Say hi.</p>
            </div>

            <template v-for="item in items" :key="item.key">
              <span v-if="item.type === 'day'" class="day">{{ item.label }}</span>
              <template v-else>
                <div v-for="m in item.messages" :key="m.id" class="b" :class="item.own ? 'b--me' : 'b--them'">{{ m.content }}</div>
                <div class="meta" :class="{ 'meta--me': item.own }">
                  {{ clockTime(item.messages[item.messages.length - 1]!.created_at) }}<template v-if="item.seen"> · Seen</template>
                </div>
              </template>
            </template>

            <p v-if="isOutgoing" class="msgs__wait">
              Waiting for {{ name }} to accept. You can write more once they do.
            </p>
          </template>
        </template>
      </div>

      <!-- ── Composer ───────────────────────────────────────────────────── -->
      <form class="compose" :class="{ 'compose--off': !canSend }" @submit.prevent="send">
        <textarea
          ref="inputEl"
          v-model="draft"
          class="compose__box"
          rows="1"
          maxlength="5000"
          :placeholder="placeholder"
          :disabled="!canSend"
          aria-label="Message"
          @input="grow"
          @keydown.enter="onEnter"
        />
        <button class="compose__send" type="submit" :disabled="!canSend || !draft.trim() || sending" aria-label="Send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M4 12l16-8-6 16-2.5-6.5z" /></svg>
        </button>
      </form>
      <p v-if="sendError" class="compose__err">{{ sendError }}</p>
      <p v-else-if="canSend" class="compose__hint">Enter to send · Shift+Enter for a new line</p>

      <ReportModal v-if="showReport && other" :reported-user-id="other.id" :conversation-id="conv.id" @close="showReport = false" />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { DmMessage } from '~/types'
import { clockTime, dayLabel, timeLeft } from '~/utils/dmFormat'
import { roleLabel } from '~/utils/profileLabels'

const route = useRoute()
const inbox = useDmInbox()
const authStore = useAuthStore()
const unread = useDmUnread()
const { isOnline } = useOnlinePresence()
const { fetchMessages, sendMessage, acceptConversation, declineConversation, markRead } = useMessaging()
const { addFavorite, removeFavorite } = useFavorites()
const { $supabase } = useNuxtApp()
const NuxtLink = resolveComponent('NuxtLink')

const id = computed(() => route.params.id as string)
const conv = computed(() => inbox.find(id.value))
const other = computed(() => conv.value?.other_user ?? null)
const me = computed(() => authStore.profile?.id)

const name = computed(() => other.value?.display_name ?? other.value?.username ?? 'Deleted user')
const profileLink = computed(() => other.value?.username ? `/user/${other.value.username}` : undefined)
const rolePill = computed(() => {
  const r = roleLabel(other.value?.role)
  return r === 'Wearer' || r === 'Keyholder' ? r.toUpperCase() : ''
})

const lockLabel = computed(() => {
  const l = conv.value?.lock
  if (!l) return ''
  const who = l.relation === 'keyholder' ? 'Your keyholder' : 'Your wearer'
  const when = l.status === 'paused' ? 'paused' : timeLeft(l.loqed_until)
  return when ? `${who} · ${when}` : who
})
const lockLink = computed(() => conv.value?.lock?.relation === 'keyholder' ? '/dashboard/wearer' : '/dashboard/keyholder')

const isIncoming = computed(() => conv.value?.status === 'pending' && !conv.value.is_requester)
const isOutgoing = computed(() => conv.value?.status === 'pending' && conv.value.is_requester)
const canSend = computed(() => !!conv.value && !!other.value && conv.value.status === 'accepted')
const placeholder = computed(() => {
  if (!other.value) return 'This account no longer exists'
  if (isIncoming.value) return 'Accept the request to reply'
  if (isOutgoing.value) return `Waiting for ${name.value} to accept`
  return 'Write a message…'
})

useHead({ title: computed(() => conv.value ? `${name.value} · Messages` : 'Messages') })

// ── Messages ────────────────────────────────────────────────────────────────
const messages = ref<DmMessage[]>([])
const total = ref(0)
const loadingMessages = ref(true)
const loadingOlder = ref(false)
const scrollEl = ref<HTMLElement | null>(null)

interface DayItem { type: 'day'; key: string; label: string }
interface GroupItem { type: 'group'; key: string; own: boolean; seen: boolean; messages: DmMessage[] }

// Consecutive messages from one side share a group and a timestamp; a new
// calendar day gets a separator. "Seen" sits under my latest message when it
// is the last word in the thread and the other side has opened it since.
const items = computed<(DayItem | GroupItem)[]>(() => {
  const out: (DayItem | GroupItem)[] = []
  let day = ''
  let group: GroupItem | null = null
  for (const m of messages.value) {
    const d = new Date(m.created_at).toDateString()
    if (d !== day) {
      out.push({ type: 'day', key: `d-${d}`, label: dayLabel(m.created_at) })
      day = d
      group = null
    }
    const own = m.sender_id === me.value
    const gap = group ? new Date(m.created_at).getTime() - new Date(group.messages[group.messages.length - 1]!.created_at).getTime() : 0
    if (group && group.own === own && gap < 10 * 60_000) group.messages.push(m)
    else {
      group = { type: 'group', key: `g-${m.id}`, own, seen: false, messages: [m] }
      out.push(group)
    }
  }
  const last = messages.value[messages.value.length - 1]
  const readAt = conv.value?.other_last_read_at
  if (last && last.sender_id === me.value && readAt && new Date(readAt) >= new Date(last.created_at) && group) {
    group.seen = true
  }
  return out
})

function scrollToBottom() {
  if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
}

function nearBottom() {
  const el = scrollEl.value
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120
}

async function loadMessages() {
  loadingMessages.value = true
  try {
    const res = await fetchMessages(id.value)
    messages.value = res.messages
    total.value = res.total
  }
  catch { messages.value = [] }
  finally {
    loadingMessages.value = false
    await nextTick()
    scrollToBottom()
  }
}

async function loadOlder() {
  if (loadingOlder.value) return
  loadingOlder.value = true
  const el = scrollEl.value
  const before = el?.scrollHeight ?? 0
  try {
    const res = await fetchMessages(id.value, messages.value.length)
    const known = new Set(messages.value.map(m => m.id))
    messages.value = [...res.messages.filter(m => !known.has(m.id)), ...messages.value]
    total.value = res.total
    await nextTick()
    if (el) el.scrollTop = el.scrollHeight - before
  }
  catch { /* the button stays for another try */ }
  finally { loadingOlder.value = false }
}

function addMessage(m: DmMessage) {
  if (messages.value.some(x => x.id === m.id)) return
  const stick = nearBottom() || m.sender_id === me.value
  messages.value.push(m)
  total.value += 1
  inbox.onMessage(id.value, m)
  if (stick) nextTick(scrollToBottom)
}

// ── Read state ──────────────────────────────────────────────────────────────
async function readNow() {
  if (!conv.value || document.visibilityState !== 'visible') return
  inbox.patch(id.value, { unread: 0 })
  const at = await markRead(id.value)
  if (at && conv.value?.read_receipts) {
    channel?.send({ type: 'broadcast', event: 'read', payload: { user_id: me.value, at } })
  }
  unread.refresh()
}

function onVisible() {
  if (document.visibilityState === 'visible' && (conv.value?.unread ?? 0) > 0) readNow()
}

// ── Realtime ────────────────────────────────────────────────────────────────
let channel: RealtimeChannel | null = null

function subscribe() {
  channel = $supabase.channel(`dm:${id.value}`)
  channel
    .on('broadcast', { event: 'new_dm' }, ({ payload }: { payload: DmMessage }) => {
      addMessage(payload)
      if (payload.sender_id !== me.value) {
        if (document.visibilityState === 'visible') readNow()
        else inbox.patch(id.value, { unread: (conv.value?.unread ?? 0) + 1 })
      }
    })
    .on('broadcast', { event: 'read' }, ({ payload }: { payload: { user_id: string; at: string } }) => {
      if (payload.user_id !== me.value && conv.value?.read_receipts) {
        inbox.patch(id.value, { other_last_read_at: payload.at })
      }
    })
    .subscribe()
}

// The conversation can arrive after the page (direct link, list still
// loading), so start once it is known.
let started = false
watch(conv, (c) => {
  if (!c || started) return
  started = true
  subscribe()
  loadMessages().then(() => {
    readNow()
    if (canSend.value) focusInput()
  })
}, { immediate: true })

onMounted(() => document.addEventListener('visibilitychange', onVisible))
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisible)
  if (channel) $supabase.removeChannel(channel)
})

// ── Composer ────────────────────────────────────────────────────────────────
const draft = ref('')
const sending = ref(false)
const sendError = ref('')
const inputEl = ref<HTMLTextAreaElement | null>(null)

function focusInput() {
  // Phones would pop the keyboard over the thread on every open.
  if (window.matchMedia('(pointer: fine)').matches) nextTick(() => inputEl.value?.focus({ preventScroll: true }))
}

function grow() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

// Enter sends on a keyboard. On touch screens Enter is a new line and the
// button sends, which is what people expect there.
function onEnter(e: KeyboardEvent) {
  if (e.shiftKey || e.isComposing || window.matchMedia('(pointer: coarse)').matches) return
  e.preventDefault()
  send()
}

async function send() {
  const content = draft.value.trim()
  if (!content || sending.value || !canSend.value) return
  sending.value = true
  sendError.value = ''
  draft.value = ''
  nextTick(grow)
  try {
    const msg = await sendMessage(id.value, content)
    addMessage(msg)
    inbox.patch(id.value, { unread: 0 })
    channel?.send({ type: 'broadcast', event: 'new_dm', payload: msg })
  }
  catch (err) {
    draft.value = content
    nextTick(grow)
    sendError.value = (err as Error)?.message || 'Could not send. Try again.'
  }
  finally {
    sending.value = false
    inputEl.value?.focus({ preventScroll: true })
  }
}

// ── Requests ────────────────────────────────────────────────────────────────
const responding = ref(false)
const actionError = ref('')

async function accept() {
  responding.value = true
  actionError.value = ''
  try {
    const row = await acceptConversation(id.value)
    inbox.patch(id.value, { status: row.status, responded_at: row.responded_at })
    await nextTick()
    scrollToBottom()
    focusInput()
  }
  catch (err) { actionError.value = (err as Error)?.message || 'Could not accept. Try again.' }
  finally { responding.value = false }
}

async function decline() {
  responding.value = true
  actionError.value = ''
  try {
    await declineConversation(id.value)
    inbox.remove(id.value)
    await navigateTo('/messages')
  }
  catch (err) { actionError.value = (err as Error)?.message || 'Could not decline. Try again.' }
  finally { responding.value = false }
}

// ── Favorite and menu ───────────────────────────────────────────────────────
const favBusy = ref(false)
const isFavorite = computed(() => !!other.value && inbox.favorites.value.some(f => f.profile.id === other.value!.id))
onMounted(() => inbox.loadFavorites())

async function toggleFavorite() {
  const o = other.value
  if (!o) return
  favBusy.value = true
  try {
    if (isFavorite.value) {
      await removeFavorite(o.id)
      inbox.favorites.value = inbox.favorites.value.filter(f => f.profile.id !== o.id)
    }
    else {
      await addFavorite(o.id)
      inbox.favorites.value = [{
        favorite_id: `local-${o.id}`,
        created_at: new Date().toISOString(),
        profile: { id: o.id, display_name: o.display_name, username: o.username, avatar_url: o.avatar_url, role: o.role },
      }, ...inbox.favorites.value]
    }
  }
  catch { /* state stays as it was */ }
  finally { favBusy.value = false }
}

const menuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)
const showReport = ref(false)

function onDocClick(e: MouseEvent) {
  if (menuOpen.value && !menuRoot.value?.contains(e.target as Node)) menuOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped lang="scss">
@use '~/assets/styles/profile' as *;

.th-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, rgba(14, 0, 51, 0.35), rgba(14, 0, 51, 0.7));
}

.th-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 24px;
  text-align: center;
  color: var(--color-text-muted);

  strong { color: var(--color-text); font: 700 18px var(--font-display); }
  p { margin: 0; font-size: 14px; }

  &--inline { flex: 0; padding: 24px; }
}

// ── Header ──────────────────────────────────────────────────────────────────
.th {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);

  &__back {
    display: none;
    color: var(--color-text-muted);
    margin-right: -4px;

    svg { width: 24px; height: 24px; display: block; }
  }

  &__av {
    position: relative;
    flex-shrink: 0;
    width: 42px;
    height: 42px;
  }

  &__img { display: block; width: 42px; height: 42px; border-radius: 50%; }

  &__dot {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-success);
    border: 2px solid var(--color-surface);
  }

  &__mid { flex: 1; min-width: 0; }

  &__name {
    display: block;
    font: 700 17px var(--font-display);
    color: var(--color-text);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:is(a):hover { color: var(--color-accent); text-decoration: none; }
  }

  &__sub {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    align-items: center;
    margin-top: 3px;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  &__role {
    padding: 3px 9px;
    border-radius: 999px;
    background: rgba(var(--color-accent-rgb), 0.15);
    color: var(--color-accent);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  &__lock {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 999px;
    background: rgba(var(--color-cta-rgb), 0.15);
    color: var(--color-cta);
    font-size: 11px;
    font-weight: 700;
    text-decoration: none;

    svg { width: 12px; height: 12px; }
    &:hover { text-decoration: none; background: rgba(var(--color-cta-rgb), 0.25); }
  }

  &__icon {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 1.5px solid var(--color-border);
    background: none;
    color: var(--color-text-muted);
    display: grid;
    place-items: center;
    cursor: pointer;

    svg { width: 18px; height: 18px; }
    &:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-text); }
    &--on { color: var(--color-accent); border-color: rgba(var(--color-accent-rgb), 0.5); }
  }

  &__menu { position: relative; }

  &__menu-panel {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    z-index: 20;
    min-width: 170px;
    padding: 6px;
    border-radius: 14px;
    background: var(--color-elevated);
    border: 1px solid var(--color-border);
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;

    a, button {
      padding: 10px 12px;
      border: 0;
      border-radius: 10px;
      background: none;
      color: var(--color-text);
      font: 500 14px var(--font-sans);
      text-align: left;
      text-decoration: none;
      cursor: pointer;

      &:hover { background: rgba(255, 255, 255, 0.07); text-decoration: none; }
    }

    .danger { color: var(--color-danger); }
  }
}

// ── Messages ────────────────────────────────────────────────────────────────
.msgs {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;

  &__older {
    align-self: center;
    margin-bottom: 8px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    background: none;
    color: var(--color-text-muted);
    font: 600 12px var(--font-sans);
    cursor: pointer;

    &:hover:not(:disabled) { color: var(--color-text); border-color: var(--color-accent); }
  }

  &__wait {
    align-self: center;
    margin: 14px 0 0;
    padding: 8px 14px;
    border-radius: 12px;
    background: rgba(var(--color-warn-rgb), 0.1);
    color: var(--color-warn);
    font-size: 13px;
    text-align: center;
  }
}

.day {
  align-self: center;
  margin: 10px 0;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text-muted);
}

.b {
  max-width: min(64%, 520px);
  padding: 10px 14px;
  border-radius: 18px;
  line-height: 1.45;
  font-size: 15px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  &--them {
    align-self: flex-start;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  &--me {
    align-self: flex-end;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    font-weight: 500;
  }

  &--them + &--them { border-top-left-radius: 6px; }
  &--me + &--me { border-top-right-radius: 6px; }
}

.meta {
  font-size: 11px;
  color: var(--color-text-muted);
  margin: 2px 6px 10px;

  &--me { align-self: flex-end; }
}

.req {
  margin: 4px 0;
  padding: 18px;
  border-radius: 20px;
  background: linear-gradient(120deg, rgba(var(--color-brand-rgb), 0.16), rgba(var(--color-cta-rgb), 0.1));
  border: 1px solid rgba(var(--color-brand-rgb), 0.4);
  max-width: 560px;
  width: 100%;
  align-self: center;

  b { font: 700 16px var(--font-display); }
  > p { margin: 6px 0 12px; font-size: 13px; color: #E6DAFF; line-height: 1.5; }

  &__first {
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--color-bg);
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 8px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  &__btns {
    display: flex;
    gap: 10px;
    margin-top: 14px;

    .pbtn { flex: 1; }
  }

  &__err { margin: 10px 0 0 !important; color: var(--color-danger) !important; }
}

// ── Composer ────────────────────────────────────────────────────────────────
.compose {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  padding: 14px 18px 8px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);

  &--off { opacity: 0.55; }

  &__box {
    flex: 1;
    min-height: 46px;
    max-height: 160px;
    resize: none;
    border-radius: 22px;
    border: 1.5px solid var(--color-border);
    background: var(--color-bg);
    padding: 12px 16px;
    color: var(--color-text);
    font: 15px/1.4 var(--font-sans);
    outline: 0;

    &::placeholder { color: var(--color-text-muted); }
    &:focus { border-color: var(--color-accent); }
    &:disabled { cursor: not-allowed; }
  }

  &__send {
    width: 46px;
    height: 46px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 0;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    display: grid;
    place-items: center;
    cursor: pointer;

    svg { width: 20px; height: 20px; }
    &:disabled { opacity: 0.45; cursor: not-allowed; }
  }

  &__hint,
  &__err {
    margin: 0;
    padding: 0 18px 10px;
    font-size: 11px;
    color: var(--color-text-muted);
    text-align: right;
    background: var(--color-surface);
  }

  &__err { color: var(--color-danger); font-size: 12px; }
}

@media (max-width: 820px) {
  .th {
    padding: 10px 12px;
    gap: 10px;

    &__back { display: block; }
  }

  .msgs { padding: 14px 12px; }
  .b { max-width: 82%; }
  .compose { padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); }
  .compose__hint { display: none; }
}
</style>
