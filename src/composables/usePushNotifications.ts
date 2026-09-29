// TASK-097/101 — a browser's push subscription may belong to a *previous*
// account that was logged in on this device; the server only finds out
// who it actually belongs to now if we tell it. Standalone (not nested in
// usePushNotifications()) so it can run from plugins/auth.ts on every
// authenticated boot, not just when NotificationPermission.vue happens to
// be mounted (TASK-101 — that component only lives on /profile, so a user
// who never visits that page never re-claims their device).
export async function reclaimPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null

  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)),
    ])
    if (!reg) return null

    const existing = await reg.pushManager.getSubscription()
    if (!existing) return null

    const { authFetch } = useAuthFetch()
    await authFetch('/api/push/subscribe', { method: 'POST', body: existing.toJSON() })
    return existing
  }
  catch (err) {
    // Was a silent .catch(() => {}) — made a failed reclaim indistinguishable
    // from "nothing to reclaim", which is exactly the kind of gap that let
    // TASK-097's bug look "fixed" while still failing on devices where this
    // POST itself never succeeded.
    console.error('[push] Failed to reclaim subscription ownership:', err)
    return null
  }
}

export function usePushNotifications() {
  const config = useRuntimeConfig()
  const { authFetch } = useAuthFetch()

  const isSupported = ref(false)
  const isInitialized = ref(false)
  const isStandalone = ref(false)
  const permission = ref<NotificationPermission>('default')
  const isSubscribed = ref(false)
  const isLoading = ref(false)
  const lastError = ref('')

  async function init() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      isInitialized.value = true
      return
    }

    isStandalone.value = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && (navigator as Navigator & { standalone: boolean }).standalone === true)

    isSupported.value = true
    isInitialized.value = true
    permission.value = typeof Notification !== 'undefined' ? Notification.permission : 'default'

    // Check for existing subscription in the background (non-blocking) and
    // re-claim it for whoever's logged in now (TASK-097/101).
    try {
      isSubscribed.value = !!(await reclaimPushSubscription())
    }
    catch { /* non-fatal */ }
  }

  async function subscribe(): Promise<boolean> {
    if (!isSupported.value) return false

    isLoading.value = true
    try {
      // On iOS Safari, window.Notification may be undefined — skip requestPermission
      // and let pushManager.subscribe() trigger the iOS permission dialog itself
      if (typeof Notification !== 'undefined') {
        const granted = await Notification.requestPermission()
        permission.value = granted
        if (granted !== 'granted') return false
      }

      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SW not ready after 5s')), 5000)),
      ])

      if (!reg) throw new Error('No service worker registration found')
      if (!reg.pushManager) throw new Error('Push not supported in this browser (no pushManager on registration)')

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.public.vapidPublicKey as string),
      })

      await authFetch('/api/push/subscribe', {
        method: 'POST',
        body: subscription.toJSON(),
      })

      isSubscribed.value = true
      permission.value = 'granted'
      return true
    }
    catch (err) {
      lastError.value = err instanceof Error ? err.message : String(err)
      return false
    }
    finally {
      isLoading.value = false
    }
  }

  async function unsubscribe(): Promise<void> {
    if (!isSupported.value) return

    isLoading.value = true
    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()
      if (!subscription) return

      await authFetch('/api/push/unsubscribe', {
        method: 'POST',
        body: { endpoint: subscription.endpoint },
      })

      await subscription.unsubscribe()
      isSubscribed.value = false
    }
    finally {
      isLoading.value = false
    }
  }

  return { isSupported, isInitialized, isStandalone, permission, isSubscribed, isLoading, lastError, init, subscribe, unsubscribe }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}
