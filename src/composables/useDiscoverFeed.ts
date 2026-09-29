import type { RealtimeChannel } from '@supabase/supabase-js'

// TASK-147 — live clock updates on the Discover list.
//
// Broadcast, not postgres_changes, for two reasons. Realtime's postgres
// changes are filtered by RLS, and letting a client SELECT other people's
// loqs means granting row access to a table whose `combination_text` column
// is the one secret the whole product is built around. And the relay is
// client-sent rather than server-sent because the server-side REST broadcast
// in `server/utils/broadcastLoq.ts` addresses a malformed topic
// (`realtime:loq:<id>` — the `realtime:` prefix is internal, and no client
// subscribes to that name), so it has never actually delivered. See #371.
//
// Every path that changes a loq's clock publishes here: the Discover list
// itself, and the public share page.
export const DISCOVER_CHANNEL = 'discover:loqs'
export const DISCOVER_VOTE_EVENT = 'loq_vote'

export interface DiscoverVote {
  loq_id: string
  loqed_until: string
  direction: 'add' | 'remove'
  hours_changed: number
}

export function useDiscoverFeed() {
  const { $supabase } = useNuxtApp()
  let channel: RealtimeChannel | null = null

  /** Subscribe to other people's votes. Returns an unsubscribe function. */
  function listen(onVote: (vote: DiscoverVote) => void): () => void {
    channel = $supabase
      .channel(DISCOVER_CHANNEL)
      .on('broadcast', { event: DISCOVER_VOTE_EVENT }, ({ payload }: { payload: DiscoverVote }) => {
        if (payload?.loq_id && payload?.loqed_until) onVote(payload)
      })
      .subscribe()

    return () => {
      channel?.unsubscribe()
      channel = null
    }
  }

  /**
   * Tell everyone watching Discover that a clock moved. A broadcast does not
   * echo back to its sender, so the caller updates its own view directly.
   */
  function publish(vote: DiscoverVote) {
    channel?.send({ type: 'broadcast', event: DISCOVER_VOTE_EVENT, payload: vote })
  }

  /**
   * Publish from a page that is not listening — the public share page has its
   * own per-loq channel and only needs to reach Discover viewers. The channel
   * is opened, used and dropped.
   */
  async function publishDetached(vote: DiscoverVote) {
    const oneOff = $supabase.channel(DISCOVER_CHANNEL)
    await new Promise<void>((resolve) => {
      oneOff.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') resolve()
      })
      // Never block the UI on realtime.
      setTimeout(resolve, 2000)
    })
    oneOff.send({ type: 'broadcast', event: DISCOVER_VOTE_EVENT, payload: vote })
    setTimeout(() => oneOff.unsubscribe(), 1000)
  }

  return { listen, publish, publishDetached }
}
