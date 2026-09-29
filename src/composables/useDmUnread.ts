// Number of conversations with something new, shown as a badge on
// "Messages" in the nav. One poller for the whole app.
const count = ref(0)
let timer: ReturnType<typeof setInterval> | null = null
let onVisible: (() => void) | null = null

export function useDmUnread() {
  async function refresh() {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) { count.value = 0; return }
    try {
      const { authFetch } = useAuthFetch()
      const res = await authFetch<{ count: number }>('/api/conversations/unread')
      count.value = res.count
    }
    catch { /* keep the last value */ }
  }

  function start() {
    if (timer || !import.meta.client) return
    refresh()
    timer = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 60_000)
    onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
  }

  function set(n: number) { count.value = n }

  return { count: readonly(count), refresh, start, set }
}
