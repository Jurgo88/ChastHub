<template>
  <div class="dash">
    <AppNav />

    <div v-if="loading" class="dash-state">
      <div class="spinner" />
    </div>

    <div v-else-if="!conversation" class="dash-state">
      <div class="dash-state__icon">💬</div>
      <p class="dash-state__title">Conversation not found</p>
      <NuxtLink to="/messages" class="btn btn--primary">Back to Messages</NuxtLink>
    </div>

    <div v-else class="dash-body">
      <NuxtLink to="/messages" class="thread__back">← Messages</NuxtLink>

      <article class="loq-card thread">
        <div class="loq-card__summary thread__summary">
          <div class="loq-card__identity">
            <UserAvatar class="loq-card__avatar" :avatar-url="conversation.other_user?.avatar_url" :display-name="conversation.other_user?.display_name" />
            <div>
              <div class="thread__name-row">
                <NuxtLink v-if="conversation.other_user?.username" :to="`/user/${conversation.other_user.username}`" class="loq-card__name thread__name-link">
                  {{ conversation.other_user?.display_name ?? conversation.other_user?.username }}
                </NuxtLink>
                <p v-else class="loq-card__name">{{ conversation.other_user?.display_name ?? 'Unknown' }}</p>
                <AdminBadge v-if="conversation.other_user?.is_admin" />
              </div>
              <p class="loq-card__since">
                <template v-if="conversation.status === 'pending' && conversation.is_requester">Waiting for a response</template>
                <template v-else-if="conversation.status === 'pending'">Wants to message you</template>
                <template v-else>Conversation</template>
              </p>
              <OnlineIndicator :user-id="conversation.other_user?.id" :last-seen-at="conversation.other_user?.last_seen_at" />
            </div>
          </div>
          <button v-if="conversation.other_user" class="thread__report-btn" @click="showReportModal = true">Report</button>
        </div>

        <div v-if="conversation.status === 'pending' && !conversation.is_requester" class="loq-card__detail thread__requestActions">
          <p class="thread__hint">Reply to accept, or decide now:</p>
          <div class="loq-actions">
            <button class="loq-act loq-act--reject" :disabled="responding" @click="handleDecline">Decline</button>
            <button class="loq-act loq-act--accept" :disabled="responding" @click="handleAccept">✓ Accept</button>
          </div>
        </div>

        <div class="loq-card__detail thread__chat">
          <DmChat
            :conversation-id="conversation.id"
            :channel="channel"
            :can-send="canSend"
            :blocked-reason="blockedReason"
            autofocus
          />
        </div>
      </article>

      <ReportModal
        v-if="showReportModal && conversation.other_user"
        :reported-user-id="conversation.other_user.id"
        :conversation-id="conversation.id"
        @close="showReportModal = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Conversation } from '~/types'

// TASK-153 — `footer: false` opts this page out of the site-wide footer. The
// conversation is a full-height chat with the composer pinned to the bottom;
// a footer underneath it pushes the composer off-screen, and in the installed
// app there is no browser chrome to explain why.
definePageMeta({ middleware: 'auth', footer: false })

const route = useRoute()
const conversationId = route.params.id as string

const { fetchConversations, acceptConversation, declineConversation } = useMessaging()
const { $supabase } = useNuxtApp()

const loading = ref(true)
const responding = ref(false)
const conversation = ref<Conversation | null>(null)
const showReportModal = ref(false)
let channel: RealtimeChannel | null = null

const canSend = computed(() => {
  if (!conversation.value) return false
  if (conversation.value.status === 'declined') return false
  if (conversation.value.status === 'pending' && conversation.value.is_requester) return false
  return true
})

const blockedReason = computed(() => {
  if (!conversation.value) return ''
  if (conversation.value.status === 'declined') return 'This conversation was declined.'
  if (conversation.value.status === 'pending' && conversation.value.is_requester) return 'Waiting for a response before you can send another message.'
  return ''
})

onMounted(async () => {
  try {
    const res = await fetchConversations()
    conversation.value = [...res.conversations, ...res.incoming_requests, ...res.sent_requests]
      .find(c => c.id === conversationId) ?? null
    if (conversation.value) {
      channel = $supabase.channel(`dm:${conversationId}`).subscribe()
    }
  }
  finally {
    loading.value = false
  }
})

onUnmounted(() => {
  channel?.unsubscribe()
})

async function handleAccept() {
  if (!conversation.value) return
  responding.value = true
  try {
    const updated = await acceptConversation(conversation.value.id)
    conversation.value = { ...conversation.value, status: updated.status, responded_at: updated.responded_at }
  }
  finally { responding.value = false }
}

async function handleDecline() {
  if (!conversation.value) return
  responding.value = true
  try {
    const updated = await declineConversation(conversation.value.id)
    conversation.value = { ...conversation.value, status: updated.status, responded_at: updated.responded_at }
  }
  finally { responding.value = false }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/shared-ui' as *;

.thread {
  display: flex;
  flex-direction: column;

  &__back {
    display: inline-block;
    font-size: 0.8125rem;
    color: var(--color-muted);
    text-decoration: none;
    margin-bottom: 0.75rem;
    &:hover { color: var(--color-accent); }
  }

  &__summary {
    margin-bottom: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  &__report-btn {
    flex-shrink: 0;
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--color-border);
    background: none;
    color: var(--color-muted);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.12s, color 0.12s;
    &:hover { border-color: var(--color-danger, #ff6b6b); color: var(--color-danger, #ff6b6b); }
  }

  &__name-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  &__name-link {
    display: block;
    font-weight: 600;
    color: var(--color-text);
    text-decoration: none;
    &:hover { color: var(--color-accent); text-decoration: underline; }
  }

  &__requestActions {
    padding-top: 0.875rem;
    border-top: 1px solid var(--color-border);
  }

  &__hint {
    font-size: 0.8125rem;
    color: var(--color-muted);
    margin: 0 0 0.5rem;
  }

  &__chat {
    padding-top: 0.875rem;
    border-top: 1px solid var(--color-border);
    display: flex;
    flex: 1;
    min-height: 320px;
  }
}

.loq-actions {
  display: flex;
  gap: 0.5rem;
}

.loq-act {
  &--reject {
    flex: 1;
    color: var(--color-danger, #ff6b6b);
    border-color: rgba(255, 107, 107, 0.3);
    &:hover:not(:disabled) { background: rgba(255, 107, 107, 0.08); border-color: var(--color-danger, #ff6b6b); }
  }
  &--accept {
    flex: 2;
    background: var(--color-accent);
    color: #fff;
    border-color: var(--color-accent);
    &:hover:not(:disabled) { opacity: 0.88; }
  }
}

</style>
