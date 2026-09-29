import type { RealtimeChannel } from '@supabase/supabase-js'

// Module-level singleton — one shared presence channel + heartbeat for the
// whole app, not one per component that happens to call this composable.
const onlineUserIds = ref(new Set<string>())
let channel: RealtimeChannel | null = null
let heartbeatInterval: ReturnType<typeof setInterval> | null = null
let onVisibilityChange: (() => void) | null = null
let started = false

export function useOnlinePresence() {
  function start() {
    if (started || !import.meta.client) return
    const authStore = useAuthStore()
    const userId = authStore.profile?.id
    // Respect the privacy toggle: still heartbeat (own last_seen_at stays
    // fresh for our own use), but don't join the shared presence channel,
    // so this user never appears in anyone else's online set.
    if (!userId) return
    started = true

    const { authFetch } = useAuthFetch()
    // TASK-160 — `visible` lets the server count only beats from an app that
    // is actually on screen toward daily activity; a background tab still
    // keeps last_seen_at fresh.
    const beat = () => {
      authFetch('/api/profile/heartbeat', {
        method: 'POST',
        body: { visible: document.visibilityState === 'visible' },
      }).catch(() => {})
    }
    beat()
    heartbeatInterval = setInterval(beat, 60_000)
    // Coming back to the app is an "open" — beat now rather than up to a
    // minute later, or a quick look would go uncounted. At most once per 15s,
    // so flicking between tabs does not turn into a request per flick.
    let lastVisibleBeat = 0
    onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastVisibleBeat < 15_000) return
      lastVisibleBeat = Date.now()
      beat()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    if (authStore.profile?.show_online_status === false) return

    const { $supabase } = useNuxtApp()
    channel = $supabase.channel('online-users', { config: { presence: { key: userId } } })
    channel
      .on('presence', { event: 'sync' }, () => {
        onlineUserIds.value = new Set(Object.keys(channel!.presenceState()))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel?.track({ online_at: new Date().toISOString() })
        }
      })
  }

  function stop() {
    channel?.unsubscribe()
    channel = null
    if (heartbeatInterval) clearInterval(heartbeatInterval)
    heartbeatInterval = null
    if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange)
    onVisibilityChange = null
    onlineUserIds.value = new Set()
    started = false
  }

  function isOnline(userId: string | null | undefined): boolean {
    return !!userId && onlineUserIds.value.has(userId)
  }

  return { onlineUserIds, isOnline, start, stop }
}
