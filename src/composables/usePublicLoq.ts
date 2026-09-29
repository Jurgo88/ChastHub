import type { RealtimeChannel } from '@supabase/supabase-js'

export interface PublicLoqData {
  loqed_until: string
  emotion: string | null
  reason: string | null
  visitor_add_hours: number
  visitor_permission: 'add' | 'remove' | 'both'
  locked: boolean
  status: string
  paused_at: string | null
}

export interface FeedEntry {
  id: number
  direction: 'add' | 'remove'
  hours: number
  at: number
}

const MAX_FEED_ENTRIES = 5

export async function usePublicLoq(publicId: string) {
  const { publishDetached } = useDiscoverFeed()
  const loq = ref<PublicLoqData | null>(null)
  const countdown = ref('')
  const fetchError = ref('')
  const actionError = ref('')
  const loading = ref(true)
  const adjustTimeLoading = ref<'add' | 'remove' | null>(null)
  const lastAction = ref<'add' | 'remove' | null>(null)
  const alreadyActed = ref(false)
  // Live "Visitor added/removed Xh" feed — populated by this visitor's own
  // action and by broadcasts from other visitors on the same public page.
  const feed = ref<FeedEntry[]>([])
  let feedIdCounter = 0
  let interval: ReturnType<typeof setInterval> | null = null
  let channel: RealtimeChannel | null = null

  function pushFeedEntry(direction: 'add' | 'remove', hours: number) {
    feed.value = [{ id: feedIdCounter++, direction, hours, at: Date.now() }, ...feed.value].slice(0, MAX_FEED_ENTRIES)
  }

  const storageKey = `loq_added_${publicId}`

  function formatMs(ms: number): string {
    const d = Math.floor(ms / 86_400_000)
    const h = Math.floor((ms % 86_400_000) / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    const s = Math.floor((ms % 60_000) / 1_000)
    const ss = String(s).padStart(2, '0')
    if (d > 0) return `${d}d ${h}h ${m}m ${ss}s`
    if (h > 0) return `${h}h ${m}m ${ss}s`
    if (m > 0) return `${m}m ${ss}s`
    return `${ss}s`
  }

  function tick() {
    if (!loq.value?.loqed_until) { countdown.value = ''; return }
    const ms = loq.value.paused_at
      ? new Date(loq.value.loqed_until).getTime() - new Date(loq.value.paused_at).getTime()
      : new Date(loq.value.loqed_until).getTime() - Date.now()
    countdown.value = ms > 0 ? formatMs(ms) : 'Unlocked'
  }

  function startClock() {
    if (interval) clearInterval(interval)
    tick()
    interval = setInterval(tick, 1_000)
  }

  function subscribeToLoq() {
    if (!import.meta.client) return
    const { $supabase } = useNuxtApp()
    channel = $supabase
      .channel(`loq-public:${publicId}`)
      .on('broadcast', { event: 'loq_updated' }, ({ payload }: { payload: Partial<PublicLoqData> & { direction?: 'add' | 'remove'; hours_changed?: number } }) => {
        const { direction, hours_changed, ...loqPatch } = payload
        if (loq.value) loq.value = { ...loq.value, ...loqPatch }
        if (direction && hours_changed) pushFeedEntry(direction, hours_changed)
      })
      .subscribe()
  }

  // Registered before the await below: Vue only reliably binds lifecycle
  // hooks that are registered synchronously, before the first await in an
  // async setup.
  onMounted(() => {
    alreadyActed.value = !!localStorage.getItem(storageKey)
    if (!loq.value) return
    startClock()
    subscribeToLoq()
  })

  async function adjustTime(direction: 'add' | 'remove') {
    if (adjustTimeLoading.value || alreadyActed.value) return
    adjustTimeLoading.value = direction
    actionError.value = ''
    try {
      // TASK-142 — the page is public and works signed out, but if the
      // visitor does have a session, identify them so the per-account limit
      // applies rather than the weaker per-IP one.
      const token = useAuthStore().session?.access_token
      const result = await $fetch<{ loq_id: string; new_loqed_until: string; hours_changed: number; direction: 'add' | 'remove' }>(
        `/api/loq/${publicId}/adjust-time`,
        {
          method: 'POST',
          body: { direction },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      )
      if (loq.value) loq.value.loqed_until = result.new_loqed_until
      if (import.meta.client) {
        localStorage.setItem(storageKey, '1')
      }
      alreadyActed.value = true
      lastAction.value = direction
      // Broadcast doesn't echo back to the sender, so add our own entry to
      // the feed directly — other visitors get theirs via the .on() handler.
      pushFeedEntry(direction, result.hours_changed)
      // Let other visitors currently on this same public page see the
      // change live — server-side REST broadcast doesn't actually deliver
      // in this project (confirmed empirically), client channel.send() does.
      channel?.send({
        type: 'broadcast',
        event: 'loq_updated',
        payload: { loqed_until: result.new_loqed_until, direction, hours_changed: result.hours_changed },
      })

      // TASK-147 — and anyone watching the Discover list, where this same loq
      // may be on screen with a running countdown.
      void publishDetached({
        loq_id: result.loq_id,
        loqed_until: result.new_loqed_until,
        direction,
        hours_changed: result.hours_changed,
      })
    }
    catch (e: unknown) {
      const fe = e as { data?: { message?: string }; message?: string }
      actionError.value = fe?.data?.message ?? fe?.message ?? 'Failed to change the time'
    }
    finally {
      adjustTimeLoading.value = null
    }
  }

  onUnmounted(() => {
    if (interval) clearInterval(interval)
    channel?.unsubscribe()
  })

  // TASK-108 — the initial load runs through useAsyncData instead of
  // onMounted so that it happens during server rendering. That is what lets
  // the page emit Open Graph tags describing the actual loq: fetched in
  // onMounted, a social crawler saw an empty page and every shared link
  // previewed as a blank box. Nuxt serialises the result into the payload,
  // so the browser does not fetch it a second time.
  const { data, error } = await useAsyncData<PublicLoqData>(
    `public-loq:${publicId}`,
    () => $fetch<PublicLoqData>(`/api/loq/${publicId}`),
  )

  if (error.value) {
    const fe = error.value as { data?: { message?: string }; message?: string }
    fetchError.value = fe?.data?.message ?? fe?.message ?? 'Lock not found'
  }
  else {
    loq.value = data.value
  }
  loading.value = false

  // Render one frame of the countdown during SSR so the served HTML carries a
  // real remaining time rather than an empty string. The ticking interval and
  // the realtime channel stay browser-only, started from onMounted above.
  if (loq.value) tick()

  return {
    loq,
    countdown,
    fetchError,
    actionError,
    loading,
    adjustTimeLoading,
    lastAction,
    alreadyActed,
    feed,
    adjustTime,
  }
}
