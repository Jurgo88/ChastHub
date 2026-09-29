import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Loq, LoqMessage } from '~/types'

interface LoqCallbacks {
  onLoqUpdate: (loq: Loq) => void
  onMessage?: (msg: LoqMessage) => void
}

export function useRealtime() {
  const { $supabase } = useNuxtApp()

  const isConnected = ref(false)
  const isReconnecting = ref(false)

  let channels: RealtimeChannel[] = []
  let offlineHandler: (() => void) | null = null
  let onlineHandler: (() => void) | null = null

  // Registered at top-level so it runs in the correct component lifecycle context
  onUnmounted(() => {
    removeWindowListeners()
    unsubscribe()
  })

  // ─── Subscribe ─────────────────────────────────────────────────────────────

  function subscribeToLoq(
    loqId: string,
    callbacks: LoqCallbacks,
    onReconnect?: () => Promise<void>,
  ) {
    unsubscribe()
    removeWindowListeners()

    const loqCh = $supabase
      .channel(`loq:${loqId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'loqs',
        filter: `id=eq.${loqId}`,
      }, (payload) => {
        callbacks.onLoqUpdate(payload.new as Loq)
      })
      .subscribe((status) => {
        isConnected.value = status === 'SUBSCRIBED'
        isReconnecting.value = status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'
      })

    const msgCh = $supabase
      .channel(`messages:loq:${loqId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `loq_id=eq.${loqId}`,
      }, (payload) => {
        callbacks.onMessage?.(payload.new as LoqMessage)
      })
      .subscribe()

    channels = [loqCh, msgCh]

    if (onReconnect) {
      offlineHandler = () => {
        isConnected.value = false
        isReconnecting.value = true
      }
      onlineHandler = async () => {
        isReconnecting.value = false
        await onReconnect()
        subscribeToLoq(loqId, callbacks, onReconnect)
      }
      window.addEventListener('offline', offlineHandler)
      window.addEventListener('online', onlineHandler)
    }
  }

  // ─── Unsubscribe ───────────────────────────────────────────────────────────

  function unsubscribe() {
    channels.forEach(ch => ch.unsubscribe())
    channels = []
    isConnected.value = false
  }

  function removeWindowListeners() {
    if (offlineHandler) window.removeEventListener('offline', offlineHandler)
    if (onlineHandler) window.removeEventListener('online', onlineHandler)
    offlineHandler = null
    onlineHandler = null
  }

  return { subscribeToLoq, unsubscribe, isConnected, isReconnecting }
}
