<template>
  <section class="dml">
    <div class="dml__head">
      <h1>Messages</h1>
      <button class="dml__new" type="button" @click="inbox.showNew.value = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
        <span class="dml__new-long">New message</span><span class="dml__new-short">New</span>
      </button>
    </div>

    <label class="dml__search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input v-model="query" type="search" placeholder="Search conversations" aria-label="Search conversations">
    </label>

    <div class="dml__tabs" role="tablist">
      <button v-for="t in TABS" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key" :class="{ on: tab === t.key }" @click="tab = t.key">
        {{ t.label }}<i v-if="t.key === 'requests' && requests.length">{{ requests.length }}</i>
      </button>
    </div>

    <div class="dml__scroll">
      <div v-if="inbox.loading.value" class="dml__state"><div class="spinner spinner--sm" /></div>

      <div v-else-if="inbox.error.value" class="dml__state">
        <p>{{ inbox.error.value }}</p>
        <button class="pbtn pbtn--sm" type="button" @click="inbox.reload()">Try again</button>
      </div>

      <template v-else-if="shown.length">
        <NuxtLink
          v-for="c in shown"
          :key="c.id"
          :to="`/messages/${c.id}`"
          class="conv"
          :class="{ 'conv--on': c.id === activeId, 'conv--unread': c.unread > 0 && c.id !== activeId }"
        >
          <span class="conv__av">
            <UserAvatar class="conv__img" :avatar-url="c.other_user?.avatar_url" :display-name="c.other_user?.display_name" />
            <i v-if="isOnline(c.other_user?.id)" class="conv__dot" />
          </span>
          <span class="conv__mid">
            <span class="conv__top">
              <b>{{ nameOf(c) }}</b>
              <span>{{ listTime(c.last_message_at ?? c.created_at) }}</span>
            </span>
            <span class="conv__msg">
              <span v-if="c.lock" class="conv__chip">{{ c.lock.relation === 'keyholder' ? 'KEYHOLDER' : 'WEARER' }}</span>
              <span class="conv__text">{{ previewOf(c) }}</span>
              <i v-if="c.unread > 0 && c.id !== activeId" class="conv__udot" />
            </span>
          </span>
        </NuxtLink>
      </template>

      <div v-else-if="query.trim()" class="dml__state">
        <p>No conversation matches "{{ query.trim() }}".</p>
      </div>

      <div v-else class="dml__state dml__state--empty">
        <template v-if="tab === 'inbox'">
          <strong>No conversations yet</strong>
          <p>Find a keyholder or a wearer in Key Drop, or write to someone you know.</p>
          <button class="pbtn pbtn--primary pbtn--sm" type="button" @click="inbox.showNew.value = true">Start a conversation</button>
          <NuxtLink to="/keydrop" class="pbtn pbtn--sm">Browse Key Drop</NuxtLink>
        </template>
        <template v-else-if="tab === 'requests'">
          <strong>No message requests</strong>
          <p>When someone new writes to you, it lands here first. They can not message you again until you accept.</p>
        </template>
        <template v-else>
          <strong>Nothing waiting</strong>
          <p>First messages you send to new people stay here until they accept.</p>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Conversation } from '~/types'
import { listTime } from '~/utils/dmFormat'

const props = defineProps<{ activeId: string | null }>()

const inbox = useDmInbox()
const authStore = useAuthStore()
const { isOnline } = useOnlinePresence()

type Tab = 'inbox' | 'requests' | 'sent'
const TABS: { key: Tab; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'requests', label: 'Requests' },
  { key: 'sent', label: 'Sent' },
]

const tab = ref<Tab>('inbox')
const query = ref('')

const accepted = computed(() => inbox.all.value.filter(c => c.status === 'accepted'))
const requests = computed(() => inbox.all.value.filter(c => c.status === 'pending' && !c.is_requester))
const sent = computed(() => inbox.all.value.filter(c => c.status === 'pending' && c.is_requester))

// Opening /messages/<id> directly selects the tab the thread lives in.
watch([() => props.activeId, () => inbox.loading.value], ([id]) => {
  const c = id ? inbox.find(id) : undefined
  if (!c) return
  tab.value = c.status === 'accepted' ? 'inbox' : c.is_requester ? 'sent' : 'requests'
}, { immediate: true })

const shown = computed(() => {
  const list = tab.value === 'inbox' ? accepted.value : tab.value === 'requests' ? requests.value : sent.value
  const q = query.value.trim().toLowerCase().replace(/^@/, '')
  if (!q) return list
  return list.filter(c =>
    (c.other_user?.display_name ?? '').toLowerCase().includes(q)
    || (c.other_user?.username ?? '').includes(q))
})

function nameOf(c: Conversation) {
  return c.other_user?.display_name ?? c.other_user?.username ?? 'Deleted user'
}

function previewOf(c: Conversation) {
  if (!c.last_message) return 'No messages yet'
  const own = c.last_message.sender_id === authStore.profile?.id
  return `${own ? 'You: ' : ''}${c.last_message.content.replace(/\s+/g, ' ')}`
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/profile' as *;

.dml {
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &__head {
    padding: 20px 18px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;

    h1 { margin: 0; font: 700 26px var(--font-display); letter-spacing: -0.02em; }
  }

  &__new {
    height: 38px;
    padding: 0 14px;
    border-radius: 999px;
    border: 0;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    font: 700 13px var(--font-sans);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;

    svg { width: 15px; height: 15px; }
    &:hover { opacity: 0.9; }
  }

  &__new-short { display: none; }

  &__search {
    margin: 0 18px 12px;
    height: 40px;
    border-radius: 12px;
    border: 1.5px solid var(--color-border);
    background: var(--color-bg);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    color: var(--color-text-muted);

    &:focus-within { border-color: var(--color-accent); }
    svg { width: 16px; height: 16px; flex-shrink: 0; }

    input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: 0;
      background: none;
      color: var(--color-text);
      font: 14px var(--font-sans);
      &::placeholder { color: var(--color-text-muted); }
    }
  }

  &__tabs {
    display: flex;
    gap: 4px;
    margin: 0 18px 8px;
    padding: 4px;
    border-radius: 999px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);

    button {
      flex: 1;
      padding: 7px 0;
      border: 0;
      border-radius: 999px;
      background: none;
      color: var(--color-text-muted);
      font: 600 13px var(--font-sans);
      cursor: pointer;

      &.on { background: var(--color-elevated); color: var(--color-text); }
    }

    i {
      font-style: normal;
      margin-left: 5px;
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--color-brand);
      color: #fff;
      font-size: 11px;
    }
  }

  &__scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 10px;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 24px;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 14px;

    p { margin: 0; line-height: 1.5; }
    strong { color: var(--color-text); font: 700 16px var(--font-display); }
  }
}

.conv {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 18px;
  border-left: 3px solid transparent;
  color: var(--color-text);
  text-decoration: none;

  &:hover { text-decoration: none; background: rgba(79, 23, 135, 0.25); }

  &--on {
    background: rgba(79, 23, 135, 0.45);
    border-left-color: var(--color-brand);
    &:hover { background: rgba(79, 23, 135, 0.45); }
  }

  &__av {
    position: relative;
    flex-shrink: 0;
    width: 46px;
    height: 46px;

  }

  &__img { display: block; width: 46px; height: 46px; border-radius: 50%; }

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

  &__mid { flex: 1; min-width: 0; display: flex; flex-direction: column; }

  &__top {
    display: flex;
    justify-content: space-between;
    gap: 8px;

    b { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    span { font-size: 12px; color: var(--color-text-muted); flex-shrink: 0; }
  }

  &__msg {
    margin-top: 3px;
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
    color: var(--color-text-muted);
    min-width: 0;
  }

  &__text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }

  &__chip {
    flex-shrink: 0;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(var(--color-cta-rgb), 0.16);
    color: var(--color-cta);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  &__udot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--color-accent);
    flex-shrink: 0;
    margin-left: auto;
  }

  &--unread {
    .conv__top b { font-weight: 800; }
    .conv__top span { color: var(--color-accent); font-weight: 700; }
    .conv__msg { color: var(--color-text); font-weight: 600; }
  }
}

@media (max-width: 820px) {
  .dml {
    &__head { padding: 16px 16px 10px; }
    &__search, &__tabs { margin-left: 16px; margin-right: 16px; }
    &__new-long { display: none; }
    &__new-short { display: inline; }
  }

  .conv { padding: 11px 16px; }
}
</style>
