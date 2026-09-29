<template>
  <div class="dm-chat">
    <div ref="messagesEl" class="dm-chat__messages">
      <div v-if="loading" class="dm-chat__loading"><div class="spinner spinner--sm" /></div>
      <template v-else>
        <div v-if="messages.length === 0" class="dm-chat__empty">
          <span class="dm-chat__empty-icon">💬</span>
          <p class="dm-chat__empty-title">No messages yet</p>
          <p class="dm-chat__empty-hint">Say hi to start the conversation.</p>
        </div>
        <template v-for="item in chatItems" :key="item.key">
          <div v-if="item.type === 'date'" class="chat-date-sep"><span>{{ item.label }}</span></div>
          <div v-else class="chat-msg" :class="{ 'chat-msg--own': item.isOwn }">
            <div
              v-for="msg in item.messages"
              :key="msg.id"
              class="chat-msg__bubble"
            >
              {{ msg.content }}
            </div>
            <div class="chat-msg__time">{{ formatTime(item.messages[item.messages.length - 1].created_at) }}</div>
          </div>
        </template>
      </template>
    </div>
    <div v-if="canSend" class="dm-chat__composer">
      <textarea
        ref="inputEl"
        v-model="draft"
        class="dm-chat__input"
        rows="1"
        placeholder="Type a message…"
        :disabled="sending"
        @keydown.enter.exact.prevent="send"
      />
      <button
        class="dm-chat__send"
        :disabled="!draft.trim() || sending"
        @click="send"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 8h10M8 4l6 4-6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <p v-else class="dm-chat__blocked">{{ blockedReason }}</p>
  </div>
</template>

<script setup lang="ts">
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { DmMessage } from '~/types'

const props = defineProps<{
  conversationId: string
  channel: RealtimeChannel | null
  canSend: boolean
  blockedReason?: string
  autofocus?: boolean
}>()

const emit = defineEmits<{ ready: [] }>()

const { authFetch } = useAuthFetch()
const { sendMessage } = useMessaging()
const authStore = useAuthStore()

const messages = ref<DmMessage[]>([])
const draft = ref('')
const loading = ref(false)
const sending = ref(false)
const messagesEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)

const currentUserId = computed(() => authStore.profile?.id)

interface DateSepItem { type: 'date'; key: string; label: string }
interface MsgGroupItem { type: 'group'; key: string; isOwn: boolean; messages: DmMessage[] }

function dateLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

// Groups consecutive messages from the same sender under one timestamp, and
// inserts a date separator whenever the calendar day changes.
const chatItems = computed<(DateSepItem | MsgGroupItem)[]>(() => {
  const items: (DateSepItem | MsgGroupItem)[] = []
  let lastDateKey = ''
  let currentGroup: MsgGroupItem | null = null

  for (const msg of messages.value) {
    const dateKey = new Date(msg.created_at).toDateString()
    if (dateKey !== lastDateKey) {
      items.push({ type: 'date', key: `date-${dateKey}`, label: dateLabel(msg.created_at) })
      lastDateKey = dateKey
      currentGroup = null
    }

    const isOwn = msg.sender_id === currentUserId.value
    if (currentGroup && currentGroup.isOwn === isOwn) {
      currentGroup.messages.push(msg)
    }
    else {
      currentGroup = { type: 'group', key: `group-${msg.id}`, isOwn, messages: [msg] }
      items.push(currentGroup)
    }
  }
  return items
})

watch(() => props.channel, (ch) => {
  if (!ch) return
  ch.on('broadcast', { event: 'new_dm' }, ({ payload }: { payload: DmMessage }) => {
    if (!messages.value.find(m => m.id === payload.id)) {
      messages.value.push(payload)
      nextTick(scrollToBottom)
    }
  })
}, { immediate: true })

onMounted(() => {
  load()
  if (props.autofocus) nextTick(() => inputEl.value?.focus({ preventScroll: true }))
})

async function load() {
  loading.value = true
  try {
    const res = await authFetch<{ messages: DmMessage[] }>(`/api/conversations/${props.conversationId}/messages`)
    messages.value = res.messages
  }
  catch { /* silently fail */ }
  finally {
    loading.value = false
    await nextTick()
    scrollToBottom()
    emit('ready')
  }
}

async function send() {
  const content = draft.value.trim()
  if (!content || sending.value) return
  draft.value = ''
  sending.value = true
  try {
    const msg = await sendMessage(props.conversationId, content)
    if (!messages.value.find(m => m.id === msg.id)) {
      messages.value.push(msg)
      await nextTick()
      scrollToBottom()
    }
    props.channel?.send({ type: 'broadcast', event: 'new_dm', payload: msg })
  }
  catch { draft.value = content }
  finally { sending.value = false }
}

function scrollToBottom() {
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style lang="scss" scoped>
.dm-chat {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100%;

  &__messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    min-height: 200px;
    padding: 0 0.25rem 0 0;

    scrollbar-width: thin;
    scrollbar-color: var(--color-accent) transparent;
    &::-webkit-scrollbar { width: 6px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: var(--color-accent); border-radius: 999px; }
  }

  &__loading { display: flex; justify-content: center; padding: 1rem 0; }

  &__empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 1.5rem 0;
    text-align: center;
  }

  &__empty-icon { font-size: 1.75rem; opacity: 0.6; }

  &__empty-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  &__empty-hint {
    font-size: 0.8125rem;
    color: var(--color-muted);
    margin: 0;
  }

  &__composer {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    border-top: 1px solid var(--color-border);
    padding-top: 0.75rem;
  }

  &__input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 1rem;
    font-size: 0.875rem;
    resize: none;
    background: var(--color-bg);
    color: var(--color-text);
    outline: none;
    line-height: 1.4;
    max-height: 80px;
    overflow-y: auto;
    font-family: inherit;

    &:focus { border-color: var(--color-accent); }
    &:disabled { opacity: 0.5; }
  }

  &__send {
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: var(--color-accent);
    color: var(--color-on-accent);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.12s;

    &:disabled { opacity: 0.4; cursor: not-allowed; }
    &:not(:disabled):hover { opacity: 0.85; }
  }

  &__blocked {
    font-size: 0.8125rem;
    color: var(--color-muted);
    text-align: center;
    border-top: 1px solid var(--color-border);
    padding-top: 0.75rem;
    margin: 0;
  }
}

// ── Date separators ──────────────────────────────────────────────────────────

.chat-date-sep {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1rem 0 0.75rem;

  &:first-child { margin-top: 0; }

  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-border);
  }

  span {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-muted);
    white-space: nowrap;
  }
}

// ── Message groups ───────────────────────────────────────────────────────────

.chat-msg {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  margin-bottom: 0.75rem;

  &--own { align-items: flex-end; }

  &__bubble {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 1rem 1rem 1rem 0.25rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    max-width: 80%;
    word-break: break-word;

    & + & { margin-top: 0.2rem; }
  }

  &--own &__bubble {
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    border-color: transparent;
    border-radius: 1rem 1rem 0.25rem 1rem;
  }

  &__time {
    font-size: 0.7rem;
    color: var(--color-muted);
    padding: 0 0.25rem;
    margin-top: 0.05rem;
  }
}

.spinner--sm {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
