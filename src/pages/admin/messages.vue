<template>
  <div class="admin-section">
    <div class="admin-section-header">
      <h1>Messages</h1>
      <span v-if="loqId" class="text-muted">Lock {{ loqId.slice(0, 8) }}…</span>
      <span v-else-if="conversationId && conversation" class="text-muted">
        DM: {{ conversation.user_a?.display_name ?? conversation.user_a?.email }}
        ↔ {{ conversation.user_b?.display_name ?? conversation.user_b?.email }}
      </span>
    </div>

    <div v-if="!loqId && !conversationId" class="admin-empty-state">
      <p>Open this page from the <NuxtLink to="/admin/locks">Locks</NuxtLink> table or a <NuxtLink to="/admin/reports">report</NuxtLink>.</p>
    </div>

    <div v-else-if="loading" class="admin-loading"><span class="admin-loading__spinner" />Loading…</div>

    <template v-else>
      <div class="messages-list">
        <div v-for="msg in messages" :key="msg.id" class="message-row">
          <div class="message-meta">
            <span class="message-sender">{{ msg.sender?.display_name || msg.sender?.email || 'Unknown' }}</span>
            <span class="message-time">{{ formatDateTime(msg.created_at) }}</span>
          </div>
          <div class="message-content">{{ msg.content }}</div>
        </div>
        <div v-if="messages.length === 0" class="admin-empty">💬 No messages in this conversation.</div>
      </div>

      <div v-if="hasMore" class="admin-pagination">
        <button class="btn btn-outline" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? 'Loading…' : 'Load older messages' }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminLevel: ['support', 'super_admin'] })

const route = useRoute()
const { authFetch } = useAuthFetch()

const loqId = computed(() => route.query.loq as string | undefined)
const conversationId = computed(() => route.query.conversation as string | undefined)
// Base endpoint for whichever source this page was opened for — loq chat
// (from the Loqs table) or a standalone DM (from a report).
const apiBase = computed(() =>
  loqId.value ? `/api/admin/loqs/${loqId.value}/messages` : `/api/admin/conversations/${conversationId.value}/messages`,
)

const conversation = ref<{ user_a: { display_name: string | null; email: string } | null; user_b: { display_name: string | null; email: string } | null } | null>(null)
const messages = ref<any[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(false)
const limit = 50

watch([loqId, conversationId], ([lq, cv]) => { if (lq || cv) fetchMessages() }, { immediate: true })

async function fetchMessages() {
  if (!loqId.value && !conversationId.value) return
  loading.value = true
  try {
    const res = await authFetch<{ messages: any[]; conversation?: typeof conversation.value }>(
      `${apiBase.value}?limit=${limit}&offset=0`,
    )
    messages.value = res.messages.reverse()
    hasMore.value = res.messages.length === limit
    if (res.conversation) conversation.value = res.conversation
  }
  finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!loqId.value && !conversationId.value) return
  loadingMore.value = true
  try {
    const res = await authFetch<{ messages: any[] }>(
      `${apiBase.value}?limit=${limit}&offset=${messages.value.length}`,
    )
    messages.value = [...res.messages.reverse(), ...messages.value]
    hasMore.value = res.messages.length === limit
  }
  finally {
    loadingMore.value = false
  }
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<style lang="scss" scoped>
@use './admin-shared';

.admin-empty-state {
  color: var(--color-text-muted);

  a {
    color: var(--color-accent);
  }
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 720px;
}

.message-row {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.message-sender {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--color-text);
}

.message-time {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.message-content {
  font-size: 0.9rem;
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
