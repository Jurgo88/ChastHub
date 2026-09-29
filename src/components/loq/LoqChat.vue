<template>
  <div class="loq-chat">
    <div ref="messagesEl" class="loq-chat__messages">
      <div v-if="loading" class="loq-chat__loading"><div class="spinner spinner--sm" /></div>
      <template v-else>
        <div v-if="messages.length === 0" class="loq-chat__empty">No messages yet.</div>
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="chat-msg"
          :class="{ 'chat-msg--own': msg.sender_id === currentUserId }"
        >
          <div class="chat-msg__bubble">{{ msg.content }}</div>
          <div class="chat-msg__time">{{ formatTime(msg.created_at) }}</div>
        </div>
      </template>
    </div>
    <div class="loq-chat__composer">
      <textarea
        ref="inputEl"
        v-model="draft"
        class="loq-chat__input"
        rows="1"
        placeholder="Type a message…"
        :disabled="sending"
        @keydown.enter.exact.prevent="send"
      />
      <button
        class="loq-chat__send"
        :disabled="!draft.trim() || sending"
        @click="send"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 8h10M8 4l6 4-6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { LoqMessage } from '~/types'

const props = defineProps<{
  loqId: string
  channel: RealtimeChannel | null
  // Focus the composer on mount — set when the chat is opened by an explicit
  // action (loqholder chat toggle), not where it's always shown (loqee dash).
  autofocus?: boolean
}>()

// Emitted once the initial messages have loaded and rendered, so the parent
// can scroll the composer into view only after the content height is final.
const emit = defineEmits<{ ready: [] }>()

const { authFetch } = useAuthFetch()
const authStore = useAuthStore()

const messages = ref<LoqMessage[]>([])
const draft = ref('')
const loading = ref(false)
const sending = ref(false)
const messagesEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)

const currentUserId = computed(() => authStore.profile?.id)

watch(() => props.channel, (ch) => {
  if (!ch) return
  ch.on('broadcast', { event: 'new_message' }, ({ payload }: { payload: LoqMessage }) => {
    if (!messages.value.find(m => m.id === payload.id)) {
      messages.value.push(payload)
      nextTick(scrollToBottom)
    }
  })
}, { immediate: true })

onMounted(() => {
  load()
  // preventScroll: the chat may be mid open-transition; don't let focus yank
  // the page or the animating container.
  if (props.autofocus) nextTick(() => inputEl.value?.focus({ preventScroll: true }))
})

async function load() {
  loading.value = true
  try {
    const res = await authFetch<{ messages: LoqMessage[] }>(`/api/loqs/${props.loqId}/messages`)
    messages.value = res.messages
  }
  catch { /* silently fail */ }
  finally {
    // Drop the loading flag first: the message list is behind v-if="loading",
    // so it isn't in the DOM until this flips. Only then can we scroll to the
    // newest message — scrolling while still loading hits an empty container.
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
    const msg = await authFetch<LoqMessage>(`/api/loqs/${props.loqId}/messages`, {
      method: 'POST',
      body: { content },
    })
    if (!messages.value.find(m => m.id === msg.id)) {
      messages.value.push(msg)
      await nextTick()
      scrollToBottom()
    }
    props.channel?.send({ type: 'broadcast', event: 'new_message', payload: msg })
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
.loq-chat {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--color-border);
  padding-top: 0.75rem;
  gap: 0.5rem;

  &__messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    max-height: 220px;
    min-height: 80px;
    padding-right: 0.25rem;

    // Minimal scrollbar: just an accent-coloured thumb, no track (Firefox)
    scrollbar-width: thin;
    scrollbar-color: var(--color-accent) transparent;

    // WebKit / Chromium
    &::-webkit-scrollbar { width: 6px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb {
      background: var(--color-accent);
      border-radius: 999px;
    }
    &::-webkit-scrollbar-thumb:hover {
      background: rgba(var(--color-accent-rgb, 99, 102, 241), 0.8);
    }
  }

  &__loading {
    display: flex;
    justify-content: center;
    padding: 0.5rem 0;
  }

  &__empty {
    font-size: 0.8125rem;
    color: var(--color-muted);
    text-align: center;
    padding: 0.5rem 0;
  }

  &__composer {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
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
    color: #fff;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.12s;

    &:disabled { opacity: 0.4; cursor: not-allowed; }
    &:not(:disabled):hover { opacity: 0.85; }
  }
}

.chat-msg {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;

  &--own { align-items: flex-end; }

  &__bubble {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 1rem 1rem 1rem 0.25rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.875rem;
    max-width: 80%;
    word-break: break-word;
  }

  &--own &__bubble {
    background: var(--color-accent);
    color: #fff;
    border-color: transparent;
    border-radius: 1rem 1rem 0.25rem 1rem;
  }

  &__time {
    font-size: 0.7rem;
    color: var(--color-muted);
    padding: 0 0.25rem;
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
