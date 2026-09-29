import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

// Called periodically by the client while the app is open (see
// useOnlinePresence). Online-right-now is tracked via Realtime Presence,
// not this table — last_seen_at is only the durable fallback shown once a
// user disconnects ("last seen 4m ago").
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const supabase = useSupabaseAdmin()

  // TASK-160 — a beat from a tab sitting in the background keeps "last seen"
  // honest but is not someone using the app, so it is left out of the daily
  // activity the KPIs count. Clients that send no body predate the flag and
  // are counted.
  const body = await readBody<{ visible?: boolean } | undefined>(event).catch(() => undefined)
  const inUse = body?.visible !== false

  const [, activity] = await Promise.all([
    supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id),
    inUse ? supabase.rpc('record_user_activity', { p_user_id: user.id }) : null,
  ])

  // Analytics must never break presence: log and carry on.
  if (activity?.error) console.error('[heartbeat] record_user_activity', activity.error.message)

  return { ok: true }
})
