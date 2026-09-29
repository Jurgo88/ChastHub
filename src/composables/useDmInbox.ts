import type { InjectionKey, Ref } from 'vue'
import type { Conversation, DmMessage, FavoriteEntry } from '~/types'

// Shared state of the Messages screen. The parent page (pages/messages.vue)
// owns it and keeps it alive while the thread on the right changes; the list,
// the thread and the "New message" dialog read and update it.
export interface DmInbox {
  loading: Ref<boolean>
  error: Ref<string>
  all: Ref<Conversation[]>
  favorites: Ref<FavoriteEntry[]>
  favoritesLoaded: Ref<boolean>
  showNew: Ref<boolean>
  reload: () => Promise<void>
  loadFavorites: () => Promise<void>
  find: (id: string) => Conversation | undefined
  findByUser: (userId: string) => Conversation | undefined
  patch: (id: string, changes: Partial<Conversation>) => void
  remove: (id: string) => void
  onMessage: (id: string, msg: DmMessage) => void
}

const KEY: InjectionKey<DmInbox> = Symbol('dm-inbox')

export function provideDmInbox(): DmInbox {
  const { fetchConversations } = useMessaging()
  const { fetchFavorites } = useFavorites()
  const unread = useDmUnread()

  const loading = ref(true)
  const error = ref('')
  const all = ref<Conversation[]>([])
  const favorites = ref<FavoriteEntry[]>([])
  const favoritesLoaded = ref(false)
  const showNew = ref(false)

  function sort() {
    all.value.sort((a, b) =>
      new Date(b.last_message_at ?? b.created_at).getTime() - new Date(a.last_message_at ?? a.created_at).getTime())
  }

  // The nav badge counts the same thing as dm_unread_total on the server.
  function syncBadge() {
    unread.set(all.value.filter(c => c.unread > 0 && !(c.status === 'pending' && c.is_requester)).length)
  }

  async function reload() {
    try {
      const res = await fetchConversations()
      all.value = [...res.conversations, ...res.incoming_requests, ...res.sent_requests]
      sort()
      syncBadge()
      error.value = ''
    }
    catch {
      if (!all.value.length) error.value = 'Could not load your messages.'
    }
    finally { loading.value = false }
  }

  async function loadFavorites() {
    if (favoritesLoaded.value) return
    try {
      favorites.value = await fetchFavorites()
      favoritesLoaded.value = true
    }
    catch { /* the dialog still works with search */ }
  }

  const find = (id: string) => all.value.find(c => c.id === id)
  const findByUser = (userId: string) => all.value.find(c => c.other_user?.id === userId)

  function patch(id: string, changes: Partial<Conversation>) {
    const c = find(id)
    if (!c) return
    Object.assign(c, changes)
    sort()
    syncBadge()
  }

  function remove(id: string) {
    all.value = all.value.filter(c => c.id !== id)
    syncBadge()
  }

  function onMessage(id: string, msg: DmMessage) {
    patch(id, { last_message: { content: msg.content, sender_id: msg.sender_id }, last_message_at: msg.created_at })
  }

  const inbox: DmInbox = { loading, error, all, favorites, favoritesLoaded, showNew, reload, loadFavorites, find, findByUser, patch, remove, onMessage }
  provide(KEY, inbox)
  return inbox
}

export function useDmInbox(): DmInbox {
  const inbox = inject(KEY)
  if (!inbox) throw new Error('useDmInbox() used outside the Messages page')
  return inbox
}
