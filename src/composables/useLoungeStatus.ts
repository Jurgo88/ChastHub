import type { LoungeStatus } from '~/types'

// One copy of the Lounge schedule for the whole app: the menu dot, the
// closed screen and the countdowns. Refreshed every minute and whenever a
// session starts or ends by the local clock.
const status = ref<LoungeStatus | null>(null)
const now = ref(Date.now())
let started = false
let loading: Promise<void> | null = null

export function useLoungeStatus() {
  async function refresh() {
    if (loading) return loading
    loading = (async () => {
      try { status.value = await $fetch<LoungeStatus>('/api/lounge/status') }
      catch { /* keep the last known schedule */ }
      finally { loading = null }
    })()
    return loading
  }

  function start() {
    if (started || !import.meta.client) return
    started = true
    refresh()
    let lastRefresh = Date.now()
    setInterval(() => {
      now.value = Date.now()
      const s = status.value
      const edge = s?.open ? s.open.end : s?.next?.start
      const crossed = edge && new Date(edge).getTime() <= now.value
      if ((crossed && now.value - lastRefresh > 5_000) || now.value - lastRefresh > 60_000) {
        lastRefresh = now.value
        refresh()
      }
    }, 1000)
  }

  const isOpen = computed(() => {
    const o = status.value?.open
    return !!o && now.value < new Date(o.end).getTime()
  })

  return { status: readonly(status), now: readonly(now), isOpen, refresh, start }
}
