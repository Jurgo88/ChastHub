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

export type ReactionKey = 'devil' | 'lock' | 'laugh' | 'fire'

// Issue #6: activity around the clock, served with the lock.
export interface PublicLoqActivity {
  recent: { direction: 'add' | 'remove'; hours: number; at: string; name: string | null }[]
  totals: { visitors: number; added_hours: number; removed_hours: number }
  top: { name: string; username: string | null; avatar_url: string | null; hours: number }[]
  reactions: Record<ReactionKey, number> | null
}

export interface FeedEntry {
  id: number
  direction: 'add' | 'remove'
  hours: number
  at: number
  name?: string | null
}

const MAX_FEED_ENTRIES = 6

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
  const totals = ref<PublicLoqActivity['totals']>({ visitors: 0, added_hours: 0, removed_hours: 0 })
  const top = ref<PublicLoqActivity['top']>([])
  const reactions = ref<PublicLoqActivity['reactions']>(null)
  const reacted = ref<Partial<Record<ReactionKey, boolean>>>({})
  const reactError = ref('')
  let feedIdCounter = 0
  let interval: ReturnType<typeof setInterval> | null = null
  let channel: RealtimeChannel | null = null

  function pushFeedEntry(direction: 'add' | 'remove', hours: number, name: string | null = null) {
    feed.value = [{ id: feedIdCounter++, direction, hours, at: Date.now(), name }, ...feed.value].slice(0, MAX_FEED_ENTRIES)
    if (direction === 'add') totals.value = { ...totals.value, added_hours: totals.value.added_hours + hours }
    else totals.value = { ...totals.value, removed_hours: totals.value.removed_hours + hours }
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
        // Only the fields the page renders; anything else in a broadcast is ignored.
        if (loq.value) {
          const next = { ...loq.value }
          if (typeof loqPatch.loqed_until === 'string') next.loqed_until = loqPatch.loqed_until
          if (loqPatch.paused_at === null || typeof loqPatch.paused_at === 'string') next.paused_at = loqPatch.paused_at
          if (typeof loqPatch.status === 'string') next.status = loqPatch.status
          if (typeof loqPatch.locked === 'boolean') next.locked = loqPatch.locked
          loq.value = next
        }
        if ((direction === 'add' || direction === 'remove') && typeof hours_changed === 'number' && hours_changed > 0 && hours_changed <= 48) {
          pushFeedEntry(direction, hours_changed)
          totals.value = { ...totals.value, visitors: totals.value.visitors + 1 }
        }
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }: { payload: { emoji?: ReactionKey; count?: number } }) => {
        const r = reactions.value
        if (!r || !payload?.emoji || !(payload.emoji in r) || typeof payload.count !== 'number') return
        // Counts only grow; a lower number from a broadcast is stale or forged.
        if (payload.count > r[payload.emoji] && payload.count <= r[payload.emoji] + 50) {
          reactions.value = { ...r, [payload.emoji]: payload.count }
        }
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
      if (!alreadyActed.value) totals.value = { ...totals.value, visitors: totals.value.visitors + 1 }
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

  async function react(emoji: ReactionKey) {
    if (reacted.value[emoji] || !reactions.value) return
    reactError.value = ''
    reacted.value = { ...reacted.value, [emoji]: true }
    reactions.value = { ...reactions.value, [emoji]: reactions.value[emoji] + 1 }
    try {
      const token = useAuthStore().session?.access_token
      const res = await $fetch<{ emoji: ReactionKey; count: number }>(`/api/loq/${publicId}/react`, {
        method: 'POST',
        body: { emoji },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (reactions.value) reactions.value = { ...reactions.value, [emoji]: res.count }
      channel?.send({ type: 'broadcast', event: 'reaction', payload: { emoji, count: res.count } })
    }
    catch (e: unknown) {
      const fe = e as { data?: { message?: string }; statusCode?: number }
      if (reactions.value) reactions.value = { ...reactions.value, [emoji]: Math.max(0, reactions.value[emoji] - 1) }
      // 429 means this visitor already reacted this hour: keep it marked.
      if (fe?.statusCode !== 429) reacted.value = { ...reacted.value, [emoji]: false }
      reactError.value = fe?.data?.message ?? 'Could not send that.'
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
  const { data, error } = await useAsyncData<PublicLoqData & PublicLoqActivity>(
    `public-loq:${publicId}`,
    () => $fetch<PublicLoqData & PublicLoqActivity>(`/api/loq/${publicId}`),
  )

  if (error.value) {
    const fe = error.value as { data?: { message?: string }; message?: string }
    fetchError.value = fe?.data?.message ?? fe?.message ?? 'Lock not found'
  }
  else if (data.value) {
    const { recent, totals: t, top: tp, reactions: rx, ...rest } = data.value
    loq.value = rest
    totals.value = t ?? totals.value
    top.value = tp ?? []
    reactions.value = rx ?? null
    feed.value = (recent ?? []).slice(0, MAX_FEED_ENTRIES).map(r => ({
      id: feedIdCounter++,
      direction: r.direction,
      hours: r.hours,
      at: new Date(r.at).getTime(),
      name: r.name,
    }))
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
    totals,
    top,
    reactions,
    reacted,
    reactError,
    react,
  }
}
